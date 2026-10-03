import { Component, ElementRef, OnDestroy, OnInit, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  barChartOutline,
  chevronBackOutline,
  chevronForwardOutline,
  refreshOutline,
  warningOutline,
} from 'ionicons/icons';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartConfiguration,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PieController,
  PointElement,
  Tooltip,
} from 'chart.js';
import { EncuestaService } from '../../core/services/encuesta.service';
import {
  AspectoDestacado,
  AtencionMozo,
  ETIQUETAS_ASPECTO,
  ETIQUETAS_ATENCION,
  ResultadosEncuestas,
} from '../../core/models/encuesta.model';

Chart.register(
  ArcElement, BarController, BarElement, CategoryScale, DoughnutController, Filler,
  Legend, LineController, LineElement, LinearScale, PieController, PointElement, Tooltip,
);

const DIAPOSITIVAS = [
  { titulo: 'Calificación general', descripcion: 'Promedio de estrellas de cada día.' },
  { titulo: 'Atención del mozo', descripcion: 'Cómo calificaron los clientes la atención.' },
  { titulo: 'Limpieza del local', descripcion: 'Cantidad de respuestas por puntaje, del 1 al 10.' },
  { titulo: 'Lo que más gustó', descripcion: 'Cuántas veces se eligió cada opción.' },
  { titulo: '¿Nos recomendarían?', descripcion: 'Clientes que nos recomendarían a sus amigos.' },
];

const ORDEN_ATENCION: AtencionMozo[] = ['excelente', 'buena', 'regular', 'mala'];
const ORDEN_ASPECTOS = Object.keys(ETIQUETAS_ASPECTO) as AspectoDestacado[];
const PUNTAJES_LIMPIEZA = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
// Distancia mínima (en píxeles) para que un deslizamiento horizontal
// cuente como "pasar de gráfico" y no como un toque.
const UMBRAL_DESLIZAMIENTO = 50;

function formatearNumero(valor: number): string {
  return valor.toLocaleString('es-AR', { maximumFractionDigits: 1 });
}

function formatearDia(dia: string): string {
  const [, mes, numero] = dia.split('-');
  return `${numero}/${mes}`;
}

function porcentaje(parte: number, total: number): string {
  return total > 0 ? `${Math.round((parte / total) * 100)}%` : '0%';
}

@Component({
  selector: 'app-encuestas-resultados',
  templateUrl: './encuestas-resultados.page.html',
  styleUrls: ['./encuestas-resultados.page.scss'],
  imports: [IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar],
  host: { class: 'ion-page' }
})
export class EncuestasResultadosPage implements OnInit, OnDestroy {
  private readonly encuestaService = inject(EncuestaService);
  private readonly router = inject(Router);

  private readonly lienzo = viewChild<ElementRef<HTMLCanvasElement>>('lienzo');
  private grafico: Chart | null = null;
  private inicioToqueX: number | null = null;

  readonly diapositivas = DIAPOSITIVAS;
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly resultados = signal<ResultadosEncuestas | null>(null);
  readonly indice = signal(0);

  readonly hayDatos = computed(() => (this.resultados()?.total ?? 0) > 0);
  readonly diapositivaActual = computed(() => DIAPOSITIVAS[this.indice()]);
  readonly destacado = computed(() => {
    const r = this.resultados();
    return r ? this.textoDestacado(this.indice(), r) : '';
  });

  constructor() { 
    addIcons({
      arrowBackOutline,
      barChartOutline,
      chevronBackOutline,
      chevronForwardOutline,
      refreshOutline,
      warningOutline,
    });

    effect(() => {
      const lienzo = this.lienzo()?.nativeElement;
      const resultados = this.resultados();
      const indice = this.indice();
      if (!lienzo || !resultados) return;

      this.grafico?.destroy();
      this.grafico = new Chart(lienzo, this.configuracion(indice, resultados) as ChartConfiguration);
    });
  }
  
  ngOnInit(): void {
    this.cargar();
  }

  ngOnDestroy(): void {
    this.grafico?.destroy();
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      this.resultados.set(await this.encuestaService.obtenerResultados());
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudieron cargar los resultados.');
      try {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } catch {
        // Ignorar si el dispositivo/navegador no soporta vibración.
      }
    } finally {
      this.cargando.set(false);
    }
  }

  anterior(): void {
    this.irA(this.indice() - 1);
  }

  siguiente(): void {
    this.irA(this.indice() + 1);
  }

  irA(indice: number): void {
    if (indice < 0 || indice >= DIAPOSITIVAS.length) return;
    this.indice.set(indice);
  }

  alEmpezarToque(evento: TouchEvent): void {
    this.inicioToqueX = evento.changedTouches[0].clientX;
  }

  alTerminarToque(evento: TouchEvent): void {
    if (this.inicioToqueX === null) return;
    const desplazamiento = evento.changedTouches[0].clientX - this.inicioToqueX;
    this.inicioToqueX = null;
    if (Math.abs(desplazamiento) < UMBRAL_DESLIZAMIENTO) return;
    if (desplazamiento < 0) {
      this.siguiente();
    } else {
      this.anterior();
    }
  }

  volver(): void {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigate(['/login'], { replaceUrl: true });
    }
  }

  private textoDestacado(indice: number, r: ResultadosEncuestas): string {
    switch (indice) {
      case 0: {
        const dias = r.promedioPorDia;
        const promedio = dias.reduce((acc, d) => acc + d.promedio, 0) / (dias.length || 1);
        return `Promedio diario: ${formatearNumero(promedio)} de 5 estrellas`;
      }
      case 1: {
        const total = ORDEN_ATENCION.reduce((acc, a) => acc + (r.atencionMozo[a] ?? 0), 0);
        const masElegida = ORDEN_ATENCION.reduce((mejor, a) =>
          (r.atencionMozo[a] ?? 0) > (r.atencionMozo[mejor] ?? 0) ? a : mejor,
        );
        return `La más elegida: ${ETIQUETAS_ATENCION[masElegida]} (${porcentaje(r.atencionMozo[masElegida] ?? 0, total)})`;
      }
      case 2: {
        let suma = 0;
        let cantidad = 0;
        for (const puntaje of PUNTAJES_LIMPIEZA) {
          const respuestas = r.limpieza[puntaje] ?? 0;
          suma += Number(puntaje) * respuestas;
          cantidad += respuestas;
        }
        return `Promedio: ${formatearNumero(cantidad ? suma / cantidad : 0)} de 10`;
      }
      case 3: {
        const masElegido = ORDEN_ASPECTOS.reduce((mejor, a) =>
          (r.aspectosDestacados[a] ?? 0) > (r.aspectosDestacados[mejor] ?? 0) ? a : mejor,
        );
        return `Lo más elegido: ${ETIQUETAS_ASPECTO[masElegido]}`;
      }
      default: {
        const total = r.recomendaria.si + r.recomendaria.no;
        return `El ${porcentaje(r.recomendaria.si, total)} nos recomendaría`;
      }
    }
  }

  private color(variable: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  }

  private configuracion(indice: number, r: ResultadosEncuestas) {
    const primario = this.color('--ion-color-primary');
    const primarioRgb = this.color('--ion-color-primary-rgb');
    const texto = this.color('--ion-text-color');
    const exito = this.color('--ion-color-success');
    const peligro = this.color('--ion-color-danger');
    const arena = this.color('--ion-color-step-500');
    const grilla = this.color('--ion-color-step-150');
    const fondoTarjeta = this.color('--ion-color-step-100');

    Chart.defaults.color = texto;
    Chart.defaults.font.size = 13;

    const base = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500 },
    };
    const leyendaAbajo = {
      legend: { position: 'bottom' as const, labels: { padding: 16, boxWidth: 14 } },
    };
    const sinLeyenda = { legend: { display: false } };

    switch (indice) {
      case 0:
        return {
          type: 'line',
          data: {
            labels: r.promedioPorDia.map((d) => formatearDia(d.dia)),
            datasets: [{
              label: 'Promedio de estrellas',
              data: r.promedioPorDia.map((d) => d.promedio),
              borderColor: primario,
              backgroundColor: `rgba(${primarioRgb}, 0.18)`,
              pointBackgroundColor: primario,
              pointRadius: 3,
              fill: true,
              tension: 0.3,
            }],
          },
          options: {
            ...base,
            plugins: sinLeyenda,
            scales: {
              x: { grid: { color: grilla }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 7 } },
              y: { min: 1, max: 5, ticks: { stepSize: 1 }, grid: { color: grilla } },
            },
          },
        } satisfies ChartConfiguration<'line'>;

      case 1:
        return {
          type: 'pie',
          data: {
            labels: ORDEN_ATENCION.map((a) => ETIQUETAS_ATENCION[a]),
            datasets: [{
              data: ORDEN_ATENCION.map((a) => r.atencionMozo[a] ?? 0),
              backgroundColor: [exito, primario, arena, peligro],
              borderColor: fondoTarjeta,
              borderWidth: 3,
            }],
          },
          options: { ...base, plugins: leyendaAbajo },
        } satisfies ChartConfiguration<'pie'>;

      case 2:
        return {
          type: 'bar',
          data: {
            labels: PUNTAJES_LIMPIEZA,
            datasets: [{
              label: 'Respuestas',
              data: PUNTAJES_LIMPIEZA.map((p) => r.limpieza[p] ?? 0),
              backgroundColor: primario,
              borderRadius: 6,
            }],
          },
          options: {
            ...base,
            plugins: sinLeyenda,
            scales: {
              x: { grid: { display: false } },
              y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: grilla } },
            },
          },
        } satisfies ChartConfiguration<'bar'>;

      case 3:
        return {
          type: 'bar',
          data: {
            labels: ORDEN_ASPECTOS.map((a) => ETIQUETAS_ASPECTO[a]),
            datasets: [{
              label: 'Veces elegida',
              data: ORDEN_ASPECTOS.map((a) => r.aspectosDestacados[a] ?? 0),
              backgroundColor: arena,
              borderColor: primario,
              borderWidth: 2,
              borderRadius: 6,
            }],
          },
          options: {
            ...base,
            indexAxis: 'y',
            plugins: sinLeyenda,
            scales: {
              x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: grilla } },
              y: { grid: { display: false } },
            },
          },
        } satisfies ChartConfiguration<'bar'>;

      default:
        return {
          type: 'doughnut',
          data: {
            labels: ['Sí', 'No'],
            datasets: [{
              data: [r.recomendaria.si, r.recomendaria.no],
              backgroundColor: [exito, peligro],
              borderColor: fondoTarjeta,
              borderWidth: 3,
            }],
          },
          options: { ...base, cutout: '60%', plugins: leyendaAbajo },
        } satisfies ChartConfiguration<'doughnut'>;
    }
  }
}
