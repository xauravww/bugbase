import { collectExport, ALL_EXPORT_SLUGS } from "@/lib/modules/export";
import { renderPdf } from "@/lib/modules/export-pdf";
import { renderXlsx } from "@/lib/modules/export-xlsx";
import fs from "fs";

const pid = Number(process.argv[2] || 6);
(async () => {
  const b = await collectExport(pid, ALL_EXPORT_SLUGS, { generatedBy: "Admin User" });
  console.log("sections:", b.sections.map(s => `${s.slug}=${s.rows.length}`).join(" "));
  console.log("total:", b.totalRecords);
  const pdf = await renderPdf(b);
  fs.writeFileSync("/tmp/out.pdf", pdf);
  const xl = await renderXlsx(b);
  fs.writeFileSync("/tmp/out.xlsx", xl);
  console.log("pdf bytes", pdf.length, "xlsx bytes", xl.length);
})();
