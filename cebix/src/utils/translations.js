/**
 * Traducciones (español → inglés). El texto en español es la clave: si falta una
 * entrada, `t()` devuelve el mismo texto, así la app nunca muestra claves vacías y
 * se puede traducir pantalla por pantalla envolviendo textos con `t("...")`.
 */
export const EN = {
  // Navegación
  Gestión: "Management",
  Análisis: "Analysis",
  Configuración: "Configuration",
  Sistema: "System", // opción de tema en Ajustes
  Resumen: "Overview",
  Parcelas: "Plots",
  Modelo: "Model",
  "Mapa satelital": "Satellite map",
  Predicciones: "Predictions",
  "Parcela satelital": "Satellite plot",
  "Validación SHAP": "SHAP validation",
  Ajustes: "Settings",
  Perfil: "Profile",
  "Cerrar sesión": "Sign out",
  "Cerrando sesión...": "Signing out...",
  "¿Cerrar sesión?": "Sign out?",
  "Tendrás que iniciar sesión de nuevo para volver a entrar.": "You'll need to sign in again to get back in.",
  Cancelar: "Cancel",
  "Abrir menú": "Open menu",
  "Cerrar menú": "Close menu",
  "Expandir menú": "Expand menu",
  "Contraer menú": "Collapse menu",

  // Títulos de pantallas
  "Resumen general": "General overview",
  "Del dato satelital a la decisión financiera.": "From satellite data to financial decisions.",
  "Todas las parcelas": "All plots",
  "Mi perfil": "My profile",
  "Tu información de cuenta en CEBIX": "Your CEBIX account information",
  "Rendimiento esperado y el motivo detrás, parcela por parcela.": "Expected yield and the reason behind it, plot by plot.",
  "Interpretabilidad del modelo: qué variables mueven la predicción y en qué dirección.":
    "Model interpretability: which variables drive the prediction and in which direction.",
  "Ejecuta el modelo con tus parcelas y consulta cómo pasa de imágenes satelitales a un rendimiento predicho.":
    "Run the model on your plots and see how it goes from satellite images to a predicted yield.",
  "Dibuja una parcela nueva y obtén su predicción con índices calculados en vivo desde imágenes reales.":
    "Draw a new plot and get its prediction with indices computed live from real imagery.",

  // Ajustes
  "Personaliza la apariencia y el comportamiento de CEBIX": "Customize the look and behavior of CEBIX",
  Restablecer: "Reset",
  Apariencia: "Appearance",
  "Elige cómo se ve CEBIX en este dispositivo": "Choose how CEBIX looks on this device",
  Claro: "Light",
  "Ideal para exteriores": "Great for outdoors",
  Oscuro: "Dark",
  "Menos fatiga visual": "Less eye strain",
  "Sigue al dispositivo": "Follows your device",
  "Color de acento": "Accent color",
  "Se usa en botones, enlaces y gráficas principales": "Used on buttons, links and main charts",
  Ámbar: "Amber",
  Cobre: "Copper",
  Oliva: "Olive",
  Pizarra: "Slate",
  Negro: "Black",
  Blanco: "White",
  Notificaciones: "Notifications",
  "Elige qué avisos quieres recibir": "Choose which alerts you want to receive",
  "Alertas por correo": "Email alerts",
  "Interruptor general: si lo apagas no recibirás ningún correo de CEBIX":
    "Master switch: if you turn it off you won't receive any CEBIX email",
  "Alertas de riesgo": "Risk alerts",
  "Cuando una parcela cambia a semáforo rojo o amarillo": "When a plot turns red or yellow on the traffic light",
  "Resumen semanal": "Weekly summary",
  "Reporte cada lunes con el estado general del portafolio": "A report every Monday with the overall portfolio status",
  "No se pudo guardar la preferencia. Intenta de nuevo.": "Couldn't save the preference. Please try again.",
  "Aviso activado.": "Alert turned on.",
  "Aviso desactivado.": "Alert turned off.",
  "No se pudieron restablecer las notificaciones.": "Couldn't reset notifications.",
  "Ajustes restablecidos.": "Settings reset.",
  "Idioma y región": "Language & region",
  "Formato de fecha, hora y zona horaria": "Date format, time and time zone",
  Idioma: "Language",
  "Formato de fecha": "Date format",
  "Zona horaria": "Time zone",
  "Vista previa": "Preview",
  "Se guardan en este dispositivo": "Saved on this device",

  // Perfil / detalle
  hoy: "today",
  "Miembro desde": "Member since",
  "Última actualización": "Last updated",
  "Última solicitud": "Last request",
  "Enviada el": "Sent on",
};

export const TRANSLATIONS = { "en-US": EN };
