import { redirect } from "next/navigation";

// Los looks de la cápsula ahora viven como pestaña dentro de /closet/capsula.
// Se conserva esta ruta como redirect para bookmarks/links viejos.
export default function CapsulaLooksPage() {
  redirect("/closet/capsula?tab=looks");
}
