import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer } from "lucide-react";

type VoucherInfo = {
  societa: string;
  piva: string;
  sede: string;
  data: string;
  autista: string;
  macchina: string;
  targa: string;
  km_inizio: string;
};

export function VoucherDialog({
  open, onOpenChange, veicolo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  veicolo: { id: string; targa: string; tipo_macchina: string | null; km_attuale: number | null } | null;
}) {
  const [oggi, setOggi] = useState<VoucherInfo | null>(null);
  const [domani, setDomani] = useState<VoucherInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !veicolo) return;
    (async () => {
      setLoading(true);
      const today = new Date(); today.setHours(0,0,0,0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      const fmt = (d: Date) => d.toISOString().split("T")[0];

      const [{ data: org }, { data: serviziOggi }, { data: serviziDomani }, { data: lastKm }] = await Promise.all([
        supabase.from("organizations").select("name, p_iva, sede_legale, address").maybeSingle(),
        supabase.from("servizi").select("autista_id, autisti(nome, cognome)").eq("data_servizio", fmt(today)).eq("veicolo_id", veicolo.id).limit(1).maybeSingle(),
        supabase.from("servizi").select("autista_id, autisti(nome, cognome)").eq("data_servizio", fmt(tomorrow)).eq("veicolo_id", veicolo.id).limit(1).maybeSingle(),
        supabase.from("veicoli_gasolio").select("km").eq("veicolo_id", veicolo.id).order("data", { ascending: false }).limit(1).maybeSingle(),
      ]);

      const km = String(lastKm?.km ?? veicolo.km_attuale ?? "");
      const societa = (org as any)?.name ?? "";
      const piva = (org as any)?.p_iva ?? "";
      const sede = (org as any)?.sede_legale ?? (org as any)?.address ?? "";
      const aOggi = (serviziOggi as any)?.autisti;
      const aDomani = (serviziDomani as any)?.autisti;
      const macchina = veicolo.tipo_macchina ?? "";

      setOggi({
        societa, piva, sede,
        data: today.toLocaleDateString("it-IT"),
        autista: aOggi ? `${aOggi.nome} ${aOggi.cognome}`.toUpperCase() : "—",
        macchina, targa: veicolo.targa, km_inizio: km,
      });
      setDomani({
        societa, piva, sede,
        data: tomorrow.toLocaleDateString("it-IT"),
        autista: aDomani ? `${aDomani.nome} ${aDomani.cognome}`.toUpperCase() : "—",
        macchina, targa: veicolo.targa, km_inizio: km,
      });
      setLoading(false);
    })();
  }, [open, veicolo]);

  const handlePrint = (info: VoucherInfo, label: string) => {
    const html = `<!DOCTYPE html><html><head><title>Voucher ${label} - ${info.targa}</title>
<style>
body{font-family:'Helvetica Neue',Arial,sans-serif;padding:40px;color:#111}
.card{border:1px solid #ddd;border-radius:12px;padding:32px;max-width:520px;margin:0 auto;background:#fafafa}
h1{text-align:center;font-style:italic;margin:0 0 24px;font-size:22px}
.row{display:flex;padding:8px 0;border-bottom:1px solid #eee;font-size:14px}
.row:last-child{border:none}
.lbl{flex:0 0 140px;font-style:italic;font-weight:600;color:#555}
.val{flex:1;font-weight:500}
.km{margin-top:16px;display:flex;align-items:center;gap:12px}
.km input{padding:8px 12px;border:1px solid #999;border-radius:6px;font-size:14px;width:160px}
@media print {body{padding:0}}
</style></head><body>
<div class="card">
<h1>Voucher ${label}</h1>
<div class="row"><div class="lbl">Società:</div><div class="val">${info.societa}</div></div>
<div class="row"><div class="lbl">Piva:</div><div class="val">${info.piva}</div></div>
<div class="row"><div class="lbl">Sede legale:</div><div class="val">${info.sede}</div></div>
<div class="row"><div class="lbl">Data Voucher:</div><div class="val">${info.data}</div></div>
<div class="row"><div class="lbl">Autista:</div><div class="val">${info.autista}</div></div>
<div class="row"><div class="lbl">Macchina:</div><div class="val">${info.macchina}</div></div>
<div class="row"><div class="lbl">Targa:</div><div class="val">${info.targa}</div></div>
<div class="km"><div class="lbl">Km Inizio:</div><div class="val">${info.km_inizio || "_______"}</div></div>
<div style="margin-top:48px;display:flex;justify-content:space-between;font-size:12px;color:#666">
<div>Firma autista: _______________________</div>
<div>Km fine: _______________</div>
</div>
</div>
<script>setTimeout(()=>window.print(),200)</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  const renderCard = (info: VoucherInfo | null, label: string, setter: (v: VoucherInfo) => void) => {
    if (!info) return null;
    return (
      <Card className="p-6 space-y-3 bg-muted/30">
        <h3 className="text-center text-lg font-display italic font-semibold">Voucher {label}</h3>
        {[
          ["Società", "societa"], ["Piva", "piva"], ["Sede legale", "sede"],
          ["Data", "data"], ["Autista", "autista"], ["Macchina", "macchina"], ["Targa", "targa"],
        ].map(([lbl, k]) => (
          <div key={k} className="flex text-sm">
            <span className="w-32 italic font-semibold text-muted-foreground">{lbl}:</span>
            <span className="font-medium">{(info as any)[k] || "—"}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-2">
          <Label className="w-32 italic font-semibold text-muted-foreground text-sm">Km Inizio:</Label>
          <Input
            className="w-40"
            value={info.km_inizio}
            onChange={(e) => setter({ ...info, km_inizio: e.target.value })}
          />
        </div>
        <Button onClick={() => handlePrint(info, label)} className="w-full gap-2 mt-2">
          <Printer className="h-4 w-4" /> Stampa
        </Button>
      </Card>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Voucher giornaliero — {veicolo?.targa}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-12 text-center text-muted-foreground">Caricamento...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderCard(oggi, "Oggi", setOggi)}
            {renderCard(domani, "Domani", setDomani)}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
