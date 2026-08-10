import { supabase } from "@/lib/supabase";

const resolveNumeroActa = async (cirun, codigoAmbiente) => {
  const { data: existing, error: searchError } = await supabase
    .from("act_responsable_acta")
    .select("numeroacta")
    .eq("cirun", cirun)
    .eq("codigoambiente", codigoAmbiente)
    .maybeSingle();

  if (searchError) throw searchError;

  if (existing?.numeroacta != null) {
    return Number(existing.numeroacta);
  }

  const { data: contadorRows, error: contadorError } = await supabase
    .from("act_contadores")
    .select("id, numeroacta")
    .order("numeroacta", { ascending: false })
    .limit(1);

  if (contadorError) throw contadorError;

  const nuevoNumero = (Number(contadorRows && contadorRows[0]?.numeroacta) || 0) + 1;

  if (contadorRows && contadorRows[0]?.id != null) {
    const { error: updateError } = await supabase
      .from("act_contadores")
      .update({ numeroacta: nuevoNumero })
      .eq("id", contadorRows[0].id);
    if (updateError) throw updateError;
  }

  const { error: insertError } = await supabase
    .from("act_responsable_acta")
    .insert({ cirun, numeroacta: nuevoNumero, codigoambiente: codigoAmbiente });

  if (insertError) throw insertError;

  return nuevoNumero;
};

const getLegacyNumeroActa = async (responsable) => {
  const { data: respRow, error: respError } = await supabase
    .from("act_responsable")
    .select("numeroacta")
    .eq("cirun", responsable.cirun)
    .maybeSingle();

  if (respError) throw respError;

  const numeroExistente = Number(respRow?.numeroacta) || 0;
  if (numeroExistente) return numeroExistente;

  const { data: contadorRows, error: contadorError } = await supabase
    .from("act_contadores")
    .select("id, numeroacta")
    .order("numeroacta", { ascending: false })
    .limit(1);

  if (contadorError) throw contadorError;

  const nuevoNumero = (Number(contadorRows && contadorRows[0]?.numeroacta) || 0) + 1;

  if (contadorRows && contadorRows[0]?.id != null) {
    const { error: updateError } = await supabase
      .from("act_contadores")
      .update({ numeroacta: nuevoNumero })
      .eq("id", contadorRows[0].id);
    if (updateError) throw updateError;
  }

  const { error: respUpdateError } = await supabase
    .from("act_responsable")
    .update({ numeroacta: nuevoNumero })
    .eq("cirun", responsable.cirun);
  if (respUpdateError) throw respUpdateError;

  return nuevoNumero;
};

export const getNumeroActa = async (responsable, locationFilters = {}) => {
  const codigoAmbiente = String(locationFilters?.ambiente ?? "").trim();
  if (codigoAmbiente) {
    return resolveNumeroActa(responsable.cirun, codigoAmbiente);
  }
  return getLegacyNumeroActa(responsable);
};
