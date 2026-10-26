# Requirements Document

## Introduction

tareas-app es una aplicación web pensada para usarse en el navegador de un teléfono. Es de uso personal: no requiere cuenta ni inicio de sesión. Al abrir la aplicación, la persona ve su lista de tareas y las herramientas para trabajarlas. Cada tarea puede registrarse con una descripción, un tipo, una duración estimada y una fecha límite. Cada tarea cuenta con un temporizador estilo pomodoro que permite iniciar y pausar el trabajo, acumulando el tiempo real invertido. Al completar una tarea, esta sale de la lista y una barra de progreso avanza. Los datos se guardan en el navegador mediante `localStorage`, detrás de un módulo de datos `src/datos/almacen.ts`.

## Glossary

- **Aplicacion**: La aplicación web tareas-app que corre en el navegador del teléfono.
- **Tarea**: Unidad de trabajo registrada por la persona, con una descripción obligatoria y datos opcionales (tipo, horas estimadas, fecha límite).
- **Tipo_De_Tarea**: Categoría de una tarea. Valores permitidos: Trabajo, Salud, Relaciones interpersonales, Hobbies.
- **Lista_De_Tareas**: Conjunto de tareas no completadas que la persona ve al abrir la Aplicacion.
- **Temporizador_Pomodoro**: Cronómetro asociado a una tarea que alterna fases de trabajo y descanso según el patrón pomodoro definido.
- **Duracion_Real**: Tiempo de trabajo acumulado en una tarea, medido por el Temporizador_Pomodoro.
- **Barra_De_Progreso**: Indicador visual que refleja el avance de tareas completadas.
- **Almacen**: Módulo de datos `src/datos/almacen.ts` que guarda y lee las tareas en `localStorage` del navegador.
- **Fase_De_Trabajo**: Periodo de 15 minutos de trabajo dentro del Temporizador_Pomodoro.
- **Fase_De_Descanso_Corto**: Periodo de 5 minutos de descanso dentro del Temporizador_Pomodoro.
- **Fase_De_Descanso_Largo**: Periodo de 10 minutos de descanso que ocurre tras completar cuatro Fases_De_Trabajo.

## Requirements

### Requirement 1: Abrir la aplicación y ver las tareas

**User Story:** Como persona que organiza su día, quiero abrir la aplicación en el teléfono y ver mis tareas de inmediato, para empezar a trabajar sin pasos previos.

#### Acceptance Criteria

1. THE Aplicacion SHALL funcionar en el navegador de un teléfono sin requerir cuenta ni inicio de sesión.
2. WHEN la persona abre la Aplicacion, THE Aplicacion SHALL mostrar la Lista_De_Tareas y las herramientas para registrar y trabajar tareas en un máximo de 3 segundos.
3. WHILE la Lista_De_Tareas no contiene tareas, THE Aplicacion SHALL mostrar un estado vacío con un mensaje que indica que no hay tareas registradas.
4. WHILE la Aplicacion recupera las tareas desde el Almacen, THE Aplicacion SHALL mostrar un estado de carga.
5. WHEN la Aplicacion termina de recuperar las tareas desde el Almacen, THE Aplicacion SHALL mostrar la Lista_De_Tareas con todas las tareas recuperadas y ocultar el estado de carga.
6. IF la recuperación de tareas desde el Almacen falla, THEN THE Aplicacion SHALL mostrar un mensaje de error que indica que no se pudieron cargar las tareas y ofrecer una acción para reintentar la carga.

### Requirement 2: Registrar una tarea

**User Story:** Como persona que planifica su trabajo, quiero registrar una tarea indicando de qué trata, su tipo, su duración estimada y si tiene fecha límite, para tener claro qué debo hacer.

#### Acceptance Criteria

1. WHEN la persona inicia el registro de una tarea, THE Aplicacion SHALL solicitar la descripción de la tarea, el Tipo_De_Tarea, las horas estimadas y la fecha límite.
2. THE Aplicacion SHALL tratar la descripción de la tarea como campo obligatorio de 1 a 200 caracteres.
3. THE Aplicacion SHALL tratar el Tipo_De_Tarea, las horas estimadas y la fecha límite como campos opcionales.
4. WHERE la persona asigna un Tipo_De_Tarea, THE Aplicacion SHALL aceptar únicamente los valores Trabajo, Salud, Relaciones interpersonales u Hobbies.
5. IF la persona intenta registrar una tarea con la descripción vacía o compuesta solo por espacios en blanco, THEN THE Aplicacion SHALL rechazar el registro, conservar los datos ya ingresados y mostrar un mensaje que indica que la descripción es obligatoria.
6. IF la persona ingresa una descripción de más de 200 caracteres, THEN THE Aplicacion SHALL rechazar el registro, conservar los datos ya ingresados y mostrar un mensaje que indica el límite de 200 caracteres.
7. IF la persona ingresa un valor de horas estimadas que no es un número entre 0 y 1000, THEN THE Aplicacion SHALL rechazar el registro, conservar los datos ya ingresados y mostrar un mensaje que indica que las horas estimadas deben ser un número válido entre 0 y 1000.
8. IF la persona ingresa una fecha límite que no es una fecha de calendario válida, THEN THE Aplicacion SHALL rechazar el registro, conservar los datos ya ingresados y mostrar un mensaje que indica que la fecha límite no es válida.
9. WHEN la persona confirma el registro de una tarea válida, THE Aplicacion SHALL agregar la tarea a la Lista_De_Tareas y mostrarla en la lista.

### Requirement 3: Temporizador pomodoro por tarea

**User Story:** Como persona que quiere concentrarme, quiero iniciar un temporizador pomodoro desde cada tarea, para enfocar mi tiempo de trabajo.

#### Acceptance Criteria

1. THE Aplicacion SHALL mostrar en cada tarea de la Lista_De_Tareas un botón para iniciar el Temporizador_Pomodoro.
2. WHEN la persona presiona el botón del Temporizador_Pomodoro de una tarea, THE Aplicacion SHALL mostrar el Temporizador_Pomodoro asociado a esa tarea con el tiempo restante de la fase en curso en formato minutos:segundos.
3. THE Temporizador_Pomodoro SHALL usar Fases_De_Trabajo de 15 minutos (900 segundos) y Fases_De_Descanso_Corto de 5 minutos (300 segundos).
4. WHEN la persona completa cuatro Fases_De_Trabajo consecutivas, THE Temporizador_Pomodoro SHALL iniciar una Fase_De_Descanso_Largo de 10 minutos (600 segundos) y reiniciar a cero el conteo de Fases_De_Trabajo completadas.
5. WHEN la persona presiona iniciar en el Temporizador_Pomodoro, THE Temporizador_Pomodoro SHALL disminuir el tiempo restante de la fase en curso en intervalos de 1 segundo y actualizar el valor mostrado en formato minutos:segundos.
6. WHEN la persona presiona pausar en el Temporizador_Pomodoro, THE Temporizador_Pomodoro SHALL detener la disminución del tiempo restante y conservar el tiempo restante de la fase en curso.
7. WHEN el tiempo restante de la fase en curso llega a cero segundos, THE Temporizador_Pomodoro SHALL mostrar un aviso visible de fin de fase e iniciar automáticamente la siguiente fase según el ciclo definido en los criterios 3 y 4.
8. IF la persona presiona pausar mientras el Temporizador_Pomodoro no está disminuyendo el tiempo, THEN THE Temporizador_Pomodoro SHALL conservar sin cambios el tiempo restante de la fase en curso.
9. IF la persona presiona iniciar mientras el Temporizador_Pomodoro ya está disminuyendo el tiempo, THEN THE Temporizador_Pomodoro SHALL continuar la fase en curso sin reiniciar el tiempo restante.

### Requirement 4: Acumular la duración real de la tarea

**User Story:** Como persona que quiere saber cuánto tiempo invierto, quiero que el tiempo trabajado se acumule en cada tarea, para conocer su duración real.

#### Acceptance Criteria

1. WHEN la persona pausa el Temporizador_Pomodoro de una tarea durante una Fase_De_Trabajo, THE Aplicacion SHALL sumar a la Duracion_Real de esa tarea únicamente el tiempo de la Fase_De_Trabajo transcurrido desde el último inicio o reanudación y aún no contabilizado.
2. WHEN la persona finaliza el Temporizador_Pomodoro de una tarea durante una Fase_De_Trabajo, THE Aplicacion SHALL sumar a la Duracion_Real de esa tarea únicamente el tiempo de la Fase_De_Trabajo transcurrido desde el último inicio o reanudación y aún no contabilizado.
3. WHEN la persona cierra el Temporizador_Pomodoro de una tarea durante una Fase_De_Trabajo, THE Aplicacion SHALL sumar a la Duracion_Real de esa tarea únicamente el tiempo de la Fase_De_Trabajo transcurrido desde el último inicio o reanudación y aún no contabilizado.
4. THE Aplicacion SHALL mostrar en cada tarea su Duracion_Real acumulada expresada en minutos enteros redondeados hacia abajo, en el rango de 0 a 999999 minutos.
5. IF la Duracion_Real acumulada de una tarea es 0, THEN THE Aplicacion SHALL mostrar el valor 0 minutos para esa tarea.
6. WHEN la Aplicacion suma tiempo a la Duracion_Real de una tarea, THE Aplicacion SHALL guardar la Duracion_Real actualizada en el Almacen.
7. IF ocurre un error al guardar la Duracion_Real en el Almacen, THEN THE Aplicacion SHALL conservar en memoria la Duracion_Real previa sin modificar y mostrar un mensaje que indica qué ocurrió y qué puede hacer la persona.

### Requirement 5: Completar una tarea y ver el progreso

**User Story:** Como persona que cierra pendientes, quiero marcar una tarea como completada, para que salga de la lista y ver mi progreso.

#### Acceptance Criteria

1. THE Aplicacion SHALL mostrar en cada tarea de la Lista_De_Tareas un control "Completado" operable con clic del ratón y con teclado (tecla Enter o Barra Espaciadora cuando el control tiene el foco).
2. WHEN la persona activa el control "Completado" en una tarea, THE Aplicacion SHALL quitar esa tarea de la Lista_De_Tareas en un tiempo máximo de 1 segundo.
3. WHEN la persona activa el control "Completado" en una tarea, THE Aplicacion SHALL recalcular la Barra_De_Progreso como el porcentaje de tareas completadas respecto al total de tareas, de 0 a 100 por ciento, y mostrar el valor redondeado al entero más cercano.
4. IF la Lista_De_Tareas no contiene tareas, THEN THE Aplicacion SHALL mostrar la Barra_De_Progreso en 0 por ciento.
5. IF la acción de completar una tarea no puede guardarse de forma permanente, THEN THE Aplicacion SHALL conservar la tarea en la Lista_De_Tareas y mostrar un mensaje de error que indique que la tarea no pudo completarse y que la persona puede intentarlo de nuevo.

### Requirement 6: Guardar las tareas en el navegador

**User Story:** Como persona que usa la aplicación en distintos momentos, quiero que mis tareas se guarden en el navegador, para no perder lo que registré.

#### Acceptance Criteria

1. WHEN la persona registra, actualiza o completa una tarea, THE Aplicacion SHALL guardar el cambio a través del Almacen en el `localStorage` del navegador en un máximo de 2 segundos.
2. WHEN la persona abre la Aplicacion, THE Aplicacion SHALL leer las tareas a través del Almacen desde el `localStorage` del navegador y mostrarlas en la Lista_De_Tareas.
3. WHEN la persona abre la Aplicacion y el Almacen no contiene tareas guardadas, THE Aplicacion SHALL mostrar la Lista_De_Tareas vacía sin mostrar un error.
4. IF el Almacen no puede guardar los datos en el `localStorage`, THEN THE Aplicacion SHALL mostrar un mensaje de error que indica que los datos no se pudieron guardar y conservar en memoria el estado previo.
5. IF el Almacen no puede leer los datos desde el `localStorage`, THEN THE Aplicacion SHALL mostrar un mensaje de error que indica que los datos no se pudieron cargar.
6. IF los datos guardados en el `localStorage` tienen un formato inválido o están dañados, THEN THE Aplicacion SHALL mostrar un mensaje de error que indica que los datos guardados no se pudieron interpretar.

### Requirement 7: Accesibilidad básica y mensajes claros

**User Story:** Como persona que usa el teléfono y a veces el teclado, quiero una interfaz accesible y con mensajes claros, para usar la aplicación con comodidad.

#### Acceptance Criteria

1. THE Aplicacion SHALL asociar una etiqueta de texto a cada campo de los formularios de registro de tareas.
2. THE Aplicacion SHALL permitir operar el registro de tareas y el Temporizador_Pomodoro mediante el teclado, con foco visible, orden de tabulación lógico y activación de controles con Enter o Barra Espaciadora.
3. THE Aplicacion SHALL mantener una relación de contraste de al menos 4.5:1 entre el texto y su fondo.
4. IF ocurre un error durante el registro, el guardado o el uso del Temporizador_Pomodoro, THEN THE Aplicacion SHALL mostrar un mensaje que indica qué ocurrió y qué puede hacer la persona, conservando los datos ya ingresados.
