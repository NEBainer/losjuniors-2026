// Alta de empleado (punto 1). Corre server-side porque
// supabase.auth.signUp() desde el cliente pisaría la sesión activa del
// dueño/supervisor logueado -> el alta en Auth tiene que hacerse con
// admin.createUser(), que solo funciona con la service_role key.
//
// Dos clientes Supabase, cada uno con un único propósito (no se mezclan):
//
// - "invocante": ANON key + el JWT que llega en el header Authorization
//   del request. SOLO se usa para leer el perfil de quien llama (sin
//   filtro adicional: la policy usuarios_pueden_ver_su_propio_perfil ya
//   garantiza que esto devuelve como máximo la fila del propio invocante).
//   Si no es dueño ni supervisor, se corta acá con 403.
//
// - "admin": SERVICE_ROLE key. SOLO se usa para auth.admin.createUser().
//   Es la única operación de este archivo que ninguna policy de RLS
//   puede cubrir (crear un usuario en Auth no es una query de tabla).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  // Preflight de CORS: ionic serve corre en otro origen que el de la
  // función, el browser manda OPTIONS antes del POST real.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "NO_AUTORIZADO" }, 401);
  }

  let email: string | undefined;
  let password: string | undefined;
  try {
    const body = await req.json();
    email = body.email;
    password = body.password;
  } catch {
    return jsonResponse({ error: "BODY_INVALIDO" }, 400);
  }

  if (!email || !password) {
    return jsonResponse({ error: "FALTAN_DATOS" }, 400);
  }

  // Cliente "invocante": únicamente para validar el perfil de quien llama.
  const clienteInvocante = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: perfilData, error: errorPerfil } = await clienteInvocante
    .from("usuarios")
    .select("perfil")
    .single();

  if (errorPerfil || !perfilData || !["dueño", "supervisor"].includes(perfilData.perfil)) {
    return jsonResponse({ error: "SIN_PERMISO" }, 403);
  }

  // Cliente "admin": únicamente para crear el usuario en Auth.
  const clienteAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: nuevoUsuario, error: errorCreate } = await clienteAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (errorCreate || !nuevoUsuario?.user) {
    const esEmailDuplicado = (errorCreate?.message ?? "").toLowerCase().includes("already");
    return jsonResponse(
      {
        error: esEmailDuplicado ? "EMAIL_YA_REGISTRADO" : "ERROR_CREAR_USUARIO",
        detalle: errorCreate?.message,
      },
      esEmailDuplicado ? 409 : 500,
    );
  }

  // Limitación conocida (sin rollback complejo, según lo acordado): si el
  // insert posterior en `usuarios` -que hace el cliente Angular después de
  // esta función- falla, este usuario de Auth queda huérfano (sin fila en
  // `usuarios`). Se resuelve a mano borrándolo desde el dashboard de Auth.
  return jsonResponse({ id: nuevoUsuario.user.id }, 200);
});
