import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { SMTPClient } from "https://deno.land/x/denomailer/mod.ts";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;
const REMITENTE = Deno.env.get("GMAIL_USUARIO")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  email: string;
  nombre: string;
  estado: "pendiente" | "aceptado" | "rechazado";
  motivo?: string;
}

function plantilla(nombre: string, estado: Payload["estado"], motivo?: string) {
  const logoUrl = "https://gbclocrtlezunqnmzdhx.supabase.co/storage/v1/object/public/fotos/branding/logo_lamesa.png";

  const base = (colorAcento: string, titulo: string, cuerpo: string) => `
    <div style="font-family: Georgia, 'Times New Roman', serif; background:#FCF7EE; padding:32px; color:#632A12;">
      <div style="max-width:480px; margin:0 auto; background:#FFFFFF; border-radius:16px; overflow:hidden; border:1px solid #EADDCB;">
        <div style="background:${colorAcento}; padding:24px; text-align:center;">
          <img src="${logoUrl}" alt="La Mesa" style="width:64px; height:64px; border-radius:50%;" />
        </div>
        <div style="padding:28px 24px;">
          <h1 style="font-size:22px; margin:0 0 12px; color:${colorAcento};">${titulo}</h1>
          <p style="font-size:15px; line-height:1.6; margin:0 0 8px;">Hola ${nombre},</p>
          <p style="font-size:15px; line-height:1.6; margin:0;">${cuerpo}</p>
        </div>
        <div style="background:#EADDCB; padding:14px; text-align:center; font-size:12px; color:#9C3B14;">
          La Mesa — Gestión de Restaurante | Este es un correo automático, no respondas a esta dirección.
        </div>
      </div>
    </div>
  `;

  switch (estado) {
    case "pendiente":
      return {
        asunto: "Recibimos tu registro en La Mesa",
        html: base("#9C3B14", "Tu registro está en revisión",
          "Ya recibimos tus datos. El equipo de La Mesa va a revisar tu solicitud y te vamos a avisar por este mismo correo apenas esté aprobada o rechazada. No es necesario que dejes la app abierta esperando.")
      };
    case "aceptado":
      return {
        asunto: "¡Tu registro en La Mesa fue aprobado!",
        html: base("#2E7D32", "Registro aprobado",
          "¡Buenas noticias! Tu registro fue aprobado y ya podés ingresar a la aplicación con tu correo y contraseña.")
      };
    case "rechazado":
      return {
        asunto: "Actualización sobre tu registro en La Mesa",
        html: base("#C0392B", "Registro no aprobado",
          `Lamentablemente tu solicitud no fue aprobada${motivo ? `. Motivo: ${motivo}` : "."} Si creés que es un error, podés acercarte al local.`)
      };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const payload: Payload = await req.json();
    const { asunto, html } = plantilla(payload.nombre, payload.estado, payload.motivo);

    const respuesta = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "La Mesa", email: REMITENTE },
        to: [{ email: payload.email, name: payload.nombre }],
        subject: asunto,
        htmlContent: html,
      }),
    });

    if (!respuesta.ok) {
      return new Response(JSON.stringify({ error: await respuesta.text() }), {
         status: 500,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
         });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { 
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});