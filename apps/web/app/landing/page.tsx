import { Header } from "@/components/Header/Header";
import CTASection from "@/components/Landing/CTASection";
import FeaturesSection from "@/components/Landing/FeaturesSection";
import HeroSection from "@/components/Landing/HeroSection";
import ProductSample from "@/components/Landing/ProductSample";
import StatsSection from "@/components/Landing/StatsSection";
import TutorialLanding from "@/components/Landing/TutorialLanding";

export default function Landing() {
	return (
		<>
			<Header />
			<main>
				<HeroSection />
				<StatsSection />
				<TutorialLanding />
				<FeaturesSection />
				<ProductSample />
				<CTASection />
			</main>
		</>
	);
}
