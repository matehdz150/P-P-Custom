/**
 * Qué productos se enseñan con el modelo 3D del termo.
 *
 * SE DECIDE POR LOS LADOS Y POR EL NOMBRE, como en la gorra. El modelo es un
 * termo de pared recta con tapa y aros de acero: un producto con varios lados
 * imprimibles no es eso, por mucho que se llame termo, y enseñarlo así sería
 * peor que no enseñar nada.
 *
 * EL CONO SE QUEDA FUERA. `forma: "cono"` es el vaso que se estrecha de arriba
 * abajo; su envoltura no es un cilindro y el diseño saldría deformado.
 *
 * POR QUÉ NO LO CUBRÍA `esTaza`. Esa comprobación exige que el nombre diga
 * «taza» o «mug», así que hasta ahora un termo no tenía vista 3D NINGUNA: se
 * quedaba en la envoltura plana. Se separan en dos porque los modelos son
 * distintos —la taza lleva asa y el termo tapa— y compartir la detección
 * obligaría a que uno de los dos saliera mal.
 */
export function esTermo3D(product: {
	name: string;
	sides: string[];
	forma?: string;
}) {
	return (
		product.forma !== "cono" &&
		product.sides.length === 1 &&
		product.sides[0] === "wrap" &&
		/\b(termos?|thermos|tumblers?)\b/i.test(product.name)
	);
}
