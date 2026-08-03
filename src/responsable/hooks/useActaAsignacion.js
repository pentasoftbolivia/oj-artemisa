import { useState, useCallback } from "react";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { supabase } from "@/lib/supabase";
import { buildDenominacion } from "@/lib/utils";
import { toCamelCaseArray } from "@/lib/mapFields";
import { useToast } from "@/hooks/use-toast";

const ESTADO_CONSERVACION_MAP = {
  1: "Bueno",
  2: "Regular",
  3: "Malo",
};

export const useActaAsignacion = () => {
  const { toast } = useToast();
  const [isPrinting, setIsPrinting] = useState(false);
  const [printingId, setPrintingId] = useState(null);

  const printActaAsignacion = useCallback(async (responsable) => {
    if (!responsable?.cirun) return;
    
    setIsPrinting(true);
    setPrintingId(responsable.cirun);
    
    try {
      // 1. Fetch assigned assets
      const { data: rawAssets, error: assetsError } = await supabase
        .from("act_activos")
        .select("*")
        .eq("cirun", responsable.cirun)
        .eq("ultimoregistro", 1)
        .not("estadoinventario", "is", null)
        .order("codigoactivo", { ascending: true });

      if (assetsError) throw assetsError;
      
      const assets = toCamelCaseArray(rawAssets || []);

      if (assets.length === 0) {
        toast({
          title: "Sin activos",
          description: "El funcionario no tiene activos asignados vigentes.",
          variant: "destructive",
        });
        return;
      }

      // 2. Fetch necessary catalogs for resolving Rubro names and Ambiente
      const [trRes, rRes, ambRes, nivelRes, inmuebleRes, ciudadRes] = await Promise.all([
        supabase.from("act_tiporubro").select("tiporubroact, codigorubroact"),
        supabase.from("act_rubro").select("codigorubroact, descripcionrubroact"),
        supabase.from("act_ambiente").select("codigoambiente, ambiente, codigonivel"),
        supabase.from("act_nivel").select("codigonivel, codigoinmueble"),
        supabase.from("act_inmueble").select("codigoinmueble, codigociudad"),
        supabase.from("act_ciudad").select("codigociudad, descripcionciudad")
      ]);

      const rubroMap = {};
      if (!rRes.error) {
        rRes.data.forEach(r => rubroMap[r.codigorubroact] = r.descripcionrubroact);
      }
      
      const tipoRubroMap = {};
      if (!trRes.error) {
        trRes.data.forEach(tr => tipoRubroMap[tr.tiporubroact] = rubroMap[tr.codigorubroact]);
      }

      // Resolve Unidad & Oficina
      let unidadName = "—";
      let oficinaName = "—";
      
      if (responsable.codigoAmbiente && !ambRes.error) {
        const amb = ambRes.data.find(a => String(a.codigoambiente).trim() === String(responsable.codigoAmbiente).trim());
        if (amb) {
          unidadName = amb.ambiente || "—";
          
          if (!nivelRes.error && !inmuebleRes.error && !ciudadRes.error) {
            const niv = nivelRes.data.find(n => n.codigonivel === amb.codigonivel);
            if (niv) {
              const inm = inmuebleRes.data.find(i => i.codigoinmueble === niv.codigoinmueble);
              if (inm) {
                const ciu = ciudadRes.data.find(c => c.codigociudad === inm.codigociudad);
                if (ciu) {
                  oficinaName = ciu.descripcionciudad || "—";
                }
              }
            }
          }
        }
      }

      // 3. Generate PDF
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "letter"
      });

      // Fonts & Base Setup
      doc.setFont("helvetica");
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // HEADER
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("ASIGNACIÓN INDIVIDUAL DE BIENES", pageWidth / 2, 20, { align: "center" });

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      
      const printDateStr = new Date().toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "long",
        year: "numeric"
      }).toUpperCase();
      
      doc.text(`FECHA DE IMPRESIÓN: ${printDateStr}`, pageWidth - 14, 28, { align: "right" });

      // Information Block
      const startYInfo = 35;
      const col1 = 14;
      const col2 = 45;
      const col3 = 140;
      const col4 = 165;
      
      doc.setFont("helvetica", "bold");
      doc.text("ENTIDAD:", col1, startYInfo);
      doc.setFont("helvetica", "normal");
      doc.text("Órgano Judicial - La Paz", col2, startYInfo);

      doc.setFont("helvetica", "bold");
      doc.text("UNIDAD:", col1, startYInfo + 6);
      doc.setFont("helvetica", "normal");
      const splitUnidad = doc.splitTextToSize(unidadName, 90);
      doc.text(splitUnidad, col2, startYInfo + 6);

      const yOffsetAfterUnidad = startYInfo + 6 + (splitUnidad.length * 4);

      doc.setFont("helvetica", "bold");
      doc.text("RESPONSABLE:", col1, yOffsetAfterUnidad);
      doc.setFont("helvetica", "normal");
      const fullName = `${responsable.nombre1 || ""} ${responsable.nombre2 || ""} ${responsable.paterno || ""} ${responsable.materno || ""}`.replace(/\s+/g, ' ').trim();
      doc.text(fullName, col2, yOffsetAfterUnidad);

      doc.setFont("helvetica", "bold");
      doc.text("CARGO:", col1, yOffsetAfterUnidad + 6);
      doc.setFont("helvetica", "normal");
      const splitCargo = doc.splitTextToSize(responsable.cargo || "—", 90);
      doc.text(splitCargo, col2, yOffsetAfterUnidad + 6);

      // Right Column of Info
      doc.setFont("helvetica", "bold");
      doc.text("ESTADO:", col3, startYInfo + 6);
      doc.setFont("helvetica", "normal");
      doc.text("CONSOLIDADO", col4, startYInfo + 6);

      doc.setFont("helvetica", "bold");
      doc.text("C.I.:", col3, yOffsetAfterUnidad);
      doc.setFont("helvetica", "normal");
      doc.text(responsable.cirun || "—", col4, yOffsetAfterUnidad);

      doc.setFont("helvetica", "bold");
      doc.text("OFICINA:", col3, yOffsetAfterUnidad + 6);
      doc.setFont("helvetica", "normal");
      doc.text(oficinaName, col4, yOffsetAfterUnidad + 6);

      // TABLE
      const tableStartY = yOffsetAfterUnidad + 6 + (splitCargo.length * 4) + 5;

      const tableData = assets.map(a => {
        const rn = tipoRubroMap[a.tipoRubroAct || a.tiporubroact] || "";
        const desc = buildDenominacion(a, rn);
        return [
          a.codigoActivo || a.codigoactivo || "—",
          a.codigoAuxiliar || a.codigoauxiliar || "—",
          desc,
          ESTADO_CONSERVACION_MAP[a.estadoConservacion || a.estadoconservacion] || "Regular"
        ];
      });

      doc.autoTable({
        startY: tableStartY,
        head: [['CÓDIGO', 'AUXILIAR', 'DESCRIPCIÓN DE ACTIVO', 'ESTADO']],
        body: tableData,
        theme: 'plain',
        styles: {
          fontSize: 8,
          cellPadding: 2,
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
        },
        headStyles: {
          fontStyle: 'bold',
          fillColor: [240, 240, 240],
          textColor: [0, 0, 0],
          halign: 'center'
        },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 20 },
          2: { cellWidth: 'auto' },
          3: { cellWidth: 20, halign: 'center' }
        },
        margin: { top: 20, left: 14, right: 14 }
      });

      const finalY = doc.lastAutoTable.finalY;

      // Footer
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`Cantidad: ${assets.length}`, 14, finalY + 8);

      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      const disclaimer = "En señal de conformidad y aceptación se firma el presente acta. El servidor público queda prohibido de usar o permitir el uso de los bienes para beneficio particular o privado, prestar o transferir el bien a otro empleado público, enajenar el bien por cuenta propia, dañar o alterar sus características físicas o técnicas, poner en riesgo el bien, ingresar o sacar bienes particulares sin autorización de la Unidad o Responsable de Activos Fijos. La no observancia a estas prohibiciones generará responsabilidades establecidas en la Ley N° 1178 y sus reglamentos.";
      const splitDisclaimer = doc.splitTextToSize(disclaimer, pageWidth - 28);
      doc.text(splitDisclaimer, 14, finalY + 15);

      // Signatures
      const sigY = finalY + 15 + (splitDisclaimer.length * 3) + 25;
      
      if (sigY > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        // If we added a page, signatures go at the top
        const newSigY = 40;
        doc.line(20, newSigY, 70, newSigY);
        doc.text("Responsable de Activos Fijos", 45, newSigY + 4, { align: "center" });

        doc.line(80, newSigY, 130, newSigY);
        doc.text("Autorización de Asignación", 105, newSigY + 4, { align: "center" });

        doc.line(140, newSigY, 190, newSigY);
        doc.text("Funcionario", 165, newSigY + 4, { align: "center" });
      } else {
        doc.line(20, sigY, 70, sigY);
        doc.text("Responsable de Activos Fijos", 45, sigY + 4, { align: "center" });

        doc.line(80, sigY, 130, sigY);
        doc.text("Autorización de Asignación", 105, sigY + 4, { align: "center" });

        doc.line(140, sigY, 190, sigY);
        doc.text("Funcionario", 165, sigY + 4, { align: "center" });
      }

      // Add system watermark or version
      doc.setFontSize(6);
      doc.text("Generado por SINAJ", 14, doc.internal.pageSize.getHeight() - 10);

      // Save PDF
      doc.save(`Acta_Asignacion_${responsable.cirun}.pdf`);

      toast({
        title: "Acta generada",
        description: `Se descargó el acta de asignación para ${responsable.cirun}`,
      });

    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "Hubo un problema al generar el acta de asignación.",
        variant: "destructive",
      });
    } finally {
      setIsPrinting(false);
      setPrintingId(null);
    }
  }, [toast]);

  return {
    printActaAsignacion,
    isPrinting,
    printingId
  };
};
