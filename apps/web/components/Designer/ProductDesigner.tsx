"use client";

import { useEffect, useRef, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import { loadProductTemplate } from "@/lib/products/loadProductsTemplate";
import type { ProductTemplate } from "@/lib/products/types";
import DesktopDesignerShell from "./DesktopDesignerShell";
import { useIsMobile } from "./hooks/useIsMobile";
import Loading from "./Loading";
import MobileDesignerShell from "./MobileDesignerShell";
import { useDesignerAutosave } from "./hooks/useDesignerAutosave";
import type { UserDesign } from "@/lib/api/user-designs";
import { Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";

export default function ProductDesigner({ productId }: { productId: string }) {
	const isMobile = useIsMobile();
	const { setConfig, sides } = useDesigner();
	const [product, setProduct] = useState<ProductTemplate | null>(null);
	const searchParams = useSearchParams();
	const draftIdParam = searchParams.get("draftId");

	// Autosave hook
	const {
		checkForExistingDraft,
		restoreDesign,
		saveDraft,
		saving,
	} = useDesignerAutosave(productId);

	const [existingDraft, setExistingDraft] = useState<UserDesign | null>(null);
	const [showRestoreModal, setShowRestoreModal] = useState(false);
	const hasCheckedDraft = useRef(false);

	useEffect(() => {
		loadProductTemplate(productId).then((tpl) => {
			setProduct(tpl as unknown as ProductTemplate);
			setConfig({
				name: tpl.name,
				rules: {
					allowText: tpl.customizationRules?.allowText ?? true,
					allowImages: tpl.customizationRules?.allowImages ?? true,
					maxDesigns: tpl.customizationRules?.maxDesigns,
					maxColorsPerDesign:
						tpl.customizationRules?.maxColorsPerDesign,
				},
				pricing: {
					basePrice: tpl.pricing?.basePrice ?? 0,
					perSidePrice: tpl.pricing?.perSidePrice,
					perDesignPrice: tpl.pricing?.perDesignPrice,
					perColorPrice: tpl.pricing?.perColorPrice,
					embroideryExtra: tpl.pricing?.embroideryExtra,
				},
			});
		});
	}, [productId, setConfig]);

	// Espera a que los canvases estén listos para verificar borradores
	useEffect(() => {
		const keys = Object.keys(sides);
		const allReady =
			keys.length > 0 && keys.every((k) => sides[k]?.canvas !== null);

		if (allReady && !hasCheckedDraft.current) {
			hasCheckedDraft.current = true;
			
			if (draftIdParam) {
				// Cargar directamente el borrador especificado por la URL
				import("@/lib/api/user-designs").then(({ getUserDesign }) => {
					getUserDesign(draftIdParam).then((draft) => {
						if (draft) {
							restoreDesign(draft);
						}
					});
				});
			} else {
				// Buscar borrador más reciente y preguntar (Opción B)
				checkForExistingDraft().then((draft) => {
					if (draft) {
						setExistingDraft(draft);
						setShowRestoreModal(true);
					}
				});
			}
		}
	}, [sides, draftIdParam, checkForExistingDraft, restoreDesign]);

	if (!product) return <Loading />;

	return (
		<>
			{isMobile ? (
				<MobileDesignerShell
					product={product}
					saveDraft={saveDraft}
					saving={saving}
				/>
			) : (
				<DesktopDesignerShell
					product={product}
					saveDraft={saveDraft}
					saving={saving}
				/>
			)}

			{/* Modal premium de recuperación de borrador (Opción B) */}
			{showRestoreModal && existingDraft && (
				<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 transition-all duration-300">
					<div className="bg-[#f5f5f1] border-2 border-[#e0e0d7] shadow-2xl rounded-2xl p-8 max-w-md w-full text-center space-y-6 relative overflow-hidden">
						<div className="w-16 h-16 bg-[#fe6241]/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#fe6241]/20">
							<Sparkles className="text-[#fe6241] w-8 h-8" />
						</div>

						<h3 className="text-xl font-black text-gray-900 tracking-tight">
							¿Quieres continuar tu diseño anterior?
						</h3>
						<p className="text-sm text-gray-600 leading-relaxed">
							Hemos encontrado un borrador de este artículo guardado recientemente. ¿Te gustaría recuperarlo y seguir editándolo?
						</p>

						<div className="flex flex-col sm:flex-row gap-3 pt-2">
							<button
								type="button"
								onClick={() => {
									setShowRestoreModal(false);
								}}
								className="w-full bg-transparent hover:bg-gray-200/50 border border-gray-300 text-gray-700 font-semibold px-4 py-2.5 rounded-xl text-sm transition-all cursor-pointer"
							>
								Empezar de cero
							</button>
							<button
								type="button"
								onClick={async () => {
									setShowRestoreModal(false);
									await restoreDesign(existingDraft);
								}}
								className="w-full bg-[#fe6241] hover:bg-[#e5573a] text-white font-bold px-4 py-2.5 rounded-xl text-sm shadow-md hover:shadow-lg transition-all cursor-pointer"
							>
								Recuperar progreso
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
