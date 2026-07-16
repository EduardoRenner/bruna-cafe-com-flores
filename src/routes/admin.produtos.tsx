import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Power } from "lucide-react";
import { categories, formatBRL, loadProducts, saveProducts, type Category, type Product } from "@/lib/products";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/produtos")({ component: ProdutosAdmin });

function emptyProduct(): Product {
  return { id: `p${Date.now()}`, name: "", description: "", price: 0, category: "Flores", image: "", active: true };
}

function ProdutosAdmin() {
  const [list, setList] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);

  useEffect(() => { setList(loadProducts()); }, []);

  function persist(next: Product[]) { setList(next); saveProducts(next); }

  function save(p: Product) {
    const idx = list.findIndex((x) => x.id === p.id);
    const next = idx >= 0 ? list.map((x) => (x.id === p.id ? p : x)) : [p, ...list];
    persist(next);
    toast.success(idx >= 0 ? "Produto atualizado" : "Produto criado");
    setEditing(null);
  }
  function toggle(p: Product) {
    persist(list.map((x) => (x.id === p.id ? { ...x, active: !x.active } : x)));
  }

  return (
    <AdminShell title="Produtos">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{list.length} produtos cadastrados</p>
        <Button onClick={() => setEditing(emptyProduct())} className="bg-rose-deep text-primary-foreground">
          <Plus className="mr-2 h-4 w-4" /> Adicionar produto
        </Button>
      </div>
      <Card className="border-none p-0 shadow-card-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-4 text-left">Produto</th>
                <th className="p-4 text-left">Categoria</th>
                <th className="p-4 text-right">Preço</th>
                <th className="p-4 text-left">Status</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-b border-border/50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {p.image ? <img src={p.image} alt="" className="h-10 w-10 rounded-md object-cover" /> : <div className="h-10 w-10 rounded-md bg-muted" />}
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="line-clamp-1 text-xs text-muted-foreground">{p.description}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-muted-foreground">{p.category}</td>
                  <td className="p-4 text-right">{formatBRL(p.price)}</td>
                  <td className="p-4">
                    <Badge variant={p.active ? "default" : "secondary"}>{p.active ? "Ativo" : "Inativo"}</Badge>
                  </td>
                  <td className="p-4 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => toggle(p)}><Power className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.name ? "Editar produto" : "Novo produto"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Preço (R$)</Label>
                  <Input type="number" step="0.01" value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} className="mt-1" />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={editing.category} onValueChange={(v) => setEditing({ ...editing, category: v as Category })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Foto (URL)</Label>
                <Input value={editing.image} onChange={(e) => setEditing({ ...editing, image: e.target.value })} className="mt-1" placeholder="https://..." />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="active">Produto ativo</Label>
                <Switch id="active" checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button className="bg-rose-deep text-primary-foreground" onClick={() => editing && save(editing)}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
