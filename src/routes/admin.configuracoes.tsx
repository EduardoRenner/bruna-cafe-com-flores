import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { store } from "@/lib/store-info";
import { formatBRL } from "@/lib/products";
import { getPassword } from "@/lib/auth";
import { adminListZones, adminUpsertZone, adminDeleteZone, adminUpdateSetting } from "@/lib/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/configuracoes")({ component: Config });

type Zone = { id?: string; bairro: string; fee: number; active: boolean };

function Config() {
  const qc = useQueryClient();
  const password = getPassword();
  const listZonesFn = useServerFn(adminListZones);
  const upsertZoneFn = useServerFn(adminUpsertZone);
  const deleteZoneFn = useServerFn(adminDeleteZone);
  const updateSettingFn = useServerFn(adminUpdateSetting);

  const [editing, setEditing] = useState<Zone | null>(null);
  const [deleting, setDeleting] = useState<Zone | null>(null);
  const [newPw, setNewPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  const { data: zones = [], isLoading } = useQuery({
    queryKey: ["admin-zones"],
    queryFn: () => listZonesFn({ data: { password } }) as Promise<Zone[]>,
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["admin-zones"] });
    qc.invalidateQueries({ queryKey: ["delivery-zones"] });
  }

  async function saveZone(z: Zone) {
    try {
      await upsertZoneFn({ data: { password, zone: { id: z.id, bairro: z.bairro, fee: Number(z.fee), active: z.active } } });
      toast.success(z.id ? "Bairro atualizado" : "Bairro adicionado");
      setEditing(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar bairro");
    }
  }

  async function removeZone(z: Zone) {
    try {
      if (z.id) await deleteZoneFn({ data: { password, id: z.id } });
      toast.success(`Bairro "${z.bairro}" removido`);
      setDeleting(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover bairro");
    }
  }

  async function changePassword() {
    if (newPw.length < 8) {
      toast.error("Senha muito curta (mínimo 8 caracteres).");
      return;
    }
    setSavingPw(true);
    try {
      await updateSettingFn({ data: { password, key: "admin_password", value: newPw } });
      toast.success("Senha do admin atualizada. Ela valerá no próximo login.");
      setNewPw("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar senha");
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <AdminShell title="Configurações">
      {/* Frete por bairro */}
      <Card className="border-none p-6 shadow-card-soft">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg">Frete por bairro</h3>
            <p className="text-sm text-muted-foreground">Bairros ativos aparecem no checkout com o valor do frete.</p>
          </div>
          <Button onClick={() => setEditing({ bairro: "", fee: 0, active: true })} className="bg-rose-deep text-primary-foreground">
            <Plus className="mr-2 h-4 w-4" /> Adicionar bairro
          </Button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Bairro</th>
                <th className="p-3 text-right">Frete</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.id} className="border-b border-border/50">
                  <td className="p-3 font-medium">{z.bairro}</td>
                  <td className="p-3 text-right">{formatBRL(Number(z.fee))}</td>
                  <td className="p-3"><Badge variant={z.active ? "default" : "secondary"}>{z.active ? "Ativo" : "Inativo"}</Badge></td>
                  <td className="p-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(z)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleting(z)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
              {!isLoading && zones.length === 0 && (
                <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Nenhum bairro cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Segurança */}
      <Card className="mt-6 border-none p-6 shadow-card-soft">
        <h3 className="font-display text-lg">Segurança</h3>
        <p className="text-sm text-muted-foreground">Alterar a senha de acesso ao painel.</p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <Label>Nova senha (mín. 8 caracteres)</Label>
            <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="mt-1 w-64" />
          </div>
          <Button onClick={changePassword} disabled={savingPw} className="bg-rose-deep text-primary-foreground">
            {savingPw ? "Salvando…" : "Atualizar senha"}
          </Button>
        </div>
      </Card>

      {/* Informações da loja */}
      <Card className="mt-6 border-none p-6 shadow-card-soft">
        <h3 className="font-display text-lg">Informações da loja</h3>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Nome</dt><dd className="font-medium">{store.name}</dd></div>
          <div><dt className="text-muted-foreground">Endereço</dt><dd className="font-medium">{store.address}</dd></div>
          <div><dt className="text-muted-foreground">Telefone</dt><dd className="font-medium">{store.phone}</dd></div>
          <div><dt className="text-muted-foreground">WhatsApp</dt><dd className="font-medium">{store.whatsapp}</dd></div>
          <div><dt className="text-muted-foreground">Instagram</dt><dd className="font-medium">@{store.instagram}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">Estes dados ficam em <code>src/lib/store-info.ts</code>.</p>
      </Card>

      {/* Dialog de bairro (via AlertDialog para simplicidade) */}
      <AlertDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{editing?.id ? "Editar bairro" : "Novo bairro"}</AlertDialogTitle>
          </AlertDialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Bairro</Label>
                <Input value={editing.bairro} onChange={(e) => setEditing({ ...editing, bairro: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Frete (R$)</Label>
                <Input type="number" step="0.01" value={editing.fee} onChange={(e) => setEditing({ ...editing, fee: Number(e.target.value) })} className="mt-1" />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label>Ativo</Label>
                <Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button className="bg-rose-deep text-primary-foreground" onClick={() => editing && saveZone(editing)}>Salvar</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover bairro</AlertDialogTitle>
            <AlertDialogDescription>
              Remover <strong>{deleting?.bairro}</strong> do frete? Pedidos existentes não são afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && removeZone(deleting)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}
