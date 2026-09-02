/**
 * Comparar texto como lo escribe la gente.
 *
 * Quien busca a "Jose Ramirez" tiene que encontrar a "José Ramírez", y quien
 * busca "queretaro" tiene que encontrar "Querétaro". Nadie escribe acentos en
 * un buscador.
 */

/**
 * El rango de diacríticos combinantes (U+0300 a U+036F), armado con
 * `fromCharCode` y no escrito en la expresión.
 *
 * PARECE UN RODEO Y NO LO ES. Escritos dentro de la expresión, esos caracteres
 * hacen que la línea deje de ser ASCII, y entonces la búsqueda depende de con
 * qué codificación se guarde el archivo: si algo la estropea —un editor, un
 * `sed`, un `curl` desde Git Bash— deja de encontrar acentos y no lo dice. Ya
 * pasó con los slugs. Con escapes también funciona, pero se convierten solos
 * al pasar por según qué herramienta; así el archivo es ASCII pase lo que
 * pase.
 */
const DIACRITICOS = new RegExp(
	`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`,
	"g",
);

export function sinAcentos(s: string) {
	return s.normalize("NFD").replace(DIACRITICOS, "").toLowerCase().trim();
}
