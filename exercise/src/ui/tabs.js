// Pestañas de la barra de navegación de la app. Datos puros: los usa tanto app.astro
// (para pintar los botones en build-time) como el shell en el cliente (para enrutar).
export const TABS = [
  { id: 'tasks', label: 'Tareas', icon: 'list' },
  { id: 'focus', label: 'Foco', icon: 'timer' },
  { id: 'garden', label: 'Jardín', icon: 'leaf' },
  { id: 'stats', label: 'Stats', icon: 'chart' },
  { id: 'settings', label: 'Ajustes', icon: 'settings' },
];
