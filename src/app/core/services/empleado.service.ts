import { Injectable, inject } from '@angular/core';
import { Camera } from '@capacitor/camera';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { PerfilUsuario } from '../models/usuario.model';

// Perfiles que puede tener un empleado dado de alta por este flujo. Tienen
// que coincidir EXACTO con los que acepta la policy de INSERT en `usuarios`
// (usuarios_dueño_supervisor_inserta_empleados) o el insert vuelve con 403.
export type PerfilEmpleado = Extract<
  PerfilUsuario,
  'supervisor' | 'metre' | 'mozo' | 'cocinero' | 'cantinero'
>;

export interface NuevoEmpleado {
  apellidos: string;
  nombres: string;
  dni: string; // ya normalizado: solo dígitos
  cuil: string; // ya normalizado: solo dígitos
  email: string;
  password: string;
  perfil: PerfilEmpleado;
  fotoWebPath: string; // uri local devuelta por tomarFoto()
}

@Injectable({ providedIn: 'root' })
export class EmpleadoService {
  private supabase = inject(SupabaseService).client;

  // Foto de perfil obligatoria tomada con cámara (no se puede elegir de
  // galería). `takePhoto` -API de @capacitor/camera v8+- es intrínsecamente
  // "solo cámara": a diferencia del `getPhoto` deprecado, no tiene opción
  // de origen, así que no hace falta forzar ningún CameraSource.
  async tomarFoto(): Promise<string> {
    const foto = await Camera.takePhoto({ quality: 80 });
    return foto.webPath!;
  }

  // Alta de empleado (punto 1), en 3 pasos:
  // 1) Edge Function `crear-empleado`: crea el usuario en Auth server-side
  //    (signUp() desde el cliente pisaría la sesión del dueño/supervisor
  //    logueado -> por eso no se usa acá).
  // 2) Sube la foto a la carpeta del id recién creado.
  // 3) Insert en `usuarios` con los datos normalizados + el PATH de la foto
  //    (no la URL pública completa: es lo que espera
  //    UsuariosService.getFotoPublicUrl() al leer perfiles).
  async crearEmpleado(datos: NuevoEmpleado): Promise<void> {
    const { data, error } = await this.supabase.functions.invoke<{ id: string }>(
      'crear-empleado',
      { body: { email: datos.email, password: datos.password } },
    );

    if (error || !data) {
      throw new Error(await this.mensajeErrorFuncion(error));
    }

    const idNuevoEmpleado = data.id;
    const rutaFoto = `usuarios/${idNuevoEmpleado}/foto.jpg`;

    try {
      const blob = await (await fetch(datos.fotoWebPath)).blob();
      const { error: errorFoto } = await this.supabase.storage
        .from('fotos')
        .upload(rutaFoto, blob, { contentType: 'image/jpeg', upsert: true });
      if (errorFoto) throw errorFoto;

      const { error: errorInsert } = await this.supabase.from('usuarios').insert({
        id: idNuevoEmpleado,
        apellidos: datos.apellidos,
        nombres: datos.nombres,
        dni: datos.dni,
        cuil: datos.cuil,
        email: datos.email,
        perfil: datos.perfil,
        foto_url: rutaFoto,
      });
      if (errorInsert) throw errorInsert;
    } catch (error) {
      // El usuario de Auth (id: idNuevoEmpleado) ya existe pero quedó sin
      // fila en `usuarios` -> huérfano. Sin rollback automático (misma
      // limitación conocida documentada en la Edge Function); se borra a
      // mano desde el dashboard de Auth si hace falta reintentar con el
      // mismo email.
      console.error(`Empleado huérfano en Auth (sin fila en usuarios), id: ${idNuevoEmpleado}`, error);

      // 23505 = violación de índice único (dni/cuil/email repetido).
      const esDuplicado = (error as { code?: string })?.code === '23505';
      throw new Error(
        esDuplicado
          ? 'El DNI, CUIL o email ya pertenece a otro usuario. Avisale a un desarrollador para borrar el usuario huérfano (id en la consola).'
          : 'El usuario se creó pero no se pudieron guardar sus datos. Avisale a un desarrollador (id en la consola).',
      );
    }
  }

  private async mensajeErrorFuncion(error: unknown): Promise<string> {
    let codigo: string | undefined;
    if (error instanceof FunctionsHttpError) {
      try {
        codigo = (await error.context.json())?.error;
      } catch {
        // Respuesta sin body JSON parseable: seguimos con el mensaje genérico.
      }
    }

    if (codigo === 'EMAIL_YA_REGISTRADO') return 'Ya existe un empleado registrado con ese email.';
    if (codigo === 'SIN_PERMISO') return 'No tenés permisos para dar de alta empleados.';
    return 'No se pudo crear el usuario del empleado. Intente nuevamente.';
  }
}
