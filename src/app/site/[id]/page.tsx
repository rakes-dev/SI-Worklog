import React from "react";
import AppLayout from "@/components/AppLayout";
import CategoriesClient from "./CategoriesClient";

export default function SitePage() {
  return (
    <AppLayout>
      <CategoriesClient />
    </AppLayout>
  );
}