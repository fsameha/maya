import { Hero } from "@/components/home/Hero";
import { Stats } from "@/components/home/Stats";
import { Problems } from "@/components/home/Problems";
import { MagicMoment } from "@/components/home/MagicMoment";
import { Doors } from "@/components/home/Doors";
import { BuiltWithMeta } from "@/components/home/BuiltWithMeta";

export default function Home() {
  return (
    <>
      <Hero />
      <Stats />
      <Problems />
      <MagicMoment />
      <Doors />
      <BuiltWithMeta />
    </>
  );
}
