export const formaterDate = (dateString: string | string[]) => {
  if (!dateString) return "Date inconnue";
  
  const dateStr = Array.isArray(dateString) ? dateString[0] : dateString;
  const date = new Date(dateStr);

  return date.toLocaleDateString('fr-FR', {
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric'
  });
};