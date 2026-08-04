import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Power, Trash2, Upload, ArrowUp, ArrowDown, GripVertical } from "lucide-react";
import { categories, formatBRL, type Category } from "@/lib/products";
import { useArrastarOrdem } from "@/components/admin/use-arrastar-ordem";
import { cn } from "@/lib/utils";
import {
  adminListProducts,
  adminUpsertProduct,
  adminDeleteProduct,
  adminUploadProductImage,
  adminMoveProductOrder,
  adminSetProductPosition,
} from "@/lib/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/produtos")({ component: ProdutosAdmin });

type AdminProduct = {
  id?: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  image_url: string | null;
  active: boolean;
  display_order?: number;
};

function emptyProduct(): AdminProduct {
  return { name: "", description: "", price: 0, category: "Flores", image_url: "", active: true };
}

function ProdutosAdmin() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListProducts);
  const upsertFn = useServerFn(adminUpsertProduct);
  const deleteFn = useServerFn(adminDeleteProduct);
  const uploadFn = useServerFn(adminUploadProductImage);
  const moveFn = useServerFn(adminMoveProductOrder);
  const setPositionFn = useServerFn(adminSetProductPosition);

  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [deleting, setDeleting] = useState<AdminProduct | null>(null);
  const [uploading, setUploading] = useState(false);
  const [reordering, setReordering] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => listFn({}) as Promise<AdminProduct[]>,
  });

  function refresh() {
    return Promise.all([
      qc.invalidateQueries({ queryKey: ["admin-products"] }),
      qc.invalidateQueries({ queryKey: ["products"] }),
    ]);
  }

  async function save(p: AdminProduct) {
    try {
      await upsertFn({
        data: {
          product: {
            id: p.id,
            name: p.name,
            description: p.description,
            price: Number(p.price),
            category: p.category,
            image_url: p.image_url,
            active: p.active,
            // Só em produto já existente: o novo sempre entra no fim.
            display_order: p.id ? p.display_order : undefined,
          },
        },
      });
      toast.success(p.id ? "Produto atualizado" : "Produto criado");
      setEditing(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar produto");
    }
  }

  async function toggle(p: AdminProduct) {
    try {
      await upsertFn({ data: { product: { ...p, active: !p.active } } });
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar");
    }
  }

  async function remove(p: AdminProduct) {
    try {
      if (p.id) await deleteFn({ data: { id: p.id } });
      toast.success(`Produto "${p.name}" excluído`);
      setDeleting(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível excluir o produto.");
    }
  }

  // A ordem que aparece aqui é exatamente a ordem que o cliente vê no
  // catálogo. O servidor renumera a lista toda, então não existe empate de
  // posição nem seta que "pula" linhas.
  async function move(index: number, dir: -1 | 1) {
    const alvo = list[index];
    if (!alvo?.id || reordering) return;
    if (index + dir < 0 || index + dir >= list.length) return;
    setReordering(true);
    try {
      await moveFn({ data: { id: alvo.id, direcao: dir === -1 ? "cima" : "baixo" } });
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao reordenar");
    } finally {
      setReordering(false);
    }
  }

  // Arrastar e soltar. Cai na mesma função de servidor do campo de posição, e
  // só resolve depois do refresh — é o que segura a prévia da tela no lugar
  // até a lista real chegar.
  async function soltar(id: string, posicao: number) {
    try {
      await setPositionFn({ data: { id, posicao } });
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao reordenar");
      await refresh();
    }
  }

  // Um hook por superfície: a tabela do desktop e os cards do mobile têm
  // markup próprio e cada um mede os próprios elementos.
  const dndTabela = useArrastarOrdem(list, soltar);
  const dndCards = useArrastarOrdem(list, soltar);

  /**
   * Quem fica em volta do produto se ele for para a posição digitada.
   * Sem isso o campo de posição é um número no vácuo: a Bruna pensa em "esse
   * fica do lado daquele", não em "esse é o 7º".
   */
  function vizinhos(id: string | undefined, posicao: number) {
    const de = list.findIndex((x) => x.id === id);
    if (de < 0 || !Number.isFinite(posicao)) return null;
    const nova = [...list];
    const [movido] = nova.splice(de, 1);
    const para = Math.min(Math.max(Math.trunc(posicao) - 1, 0), nova.length);
    nova.splice(para, 0, movido);
    return { antes: nova[para - 1]?.name ?? null, depois: nova[para + 1]?.name ?? null };
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editing) return;
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await uploadFn({
        data: { fileName: file.name, contentType: file.type, base64 },
      });
      setEditing({ ...editing, image_url: res.url });
      toast.success("Imagem enviada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload da imagem");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <AdminShell title="Produtos">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Carregando…" : `${list.length} produtos cadastrados`}
          {!isLoading && list.length > 1 && (
            <span className="block text-xs">
              Arraste pelo <GripVertical className="inline h-3 w-3 align-text-bottom" /> para mudar
              a ordem do catálogo — é essa a ordem que o cliente vê.
            </span>
          )}
        </p>
        <Button onClick={() => setEditing(emptyProduct())} className="bg-rose-deep text-primary-foreground">
          <Plus className="mr-2 h-4 w-4" /> <span className="hidden sm:inline">Adicionar produto</span><span className="sm:hidden">Adicionar</span>
        </Button>
      </div>
      <Card className="border-none p-0 shadow-card-soft">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="w-10 p-4 text-left" title="Arraste para reordenar">#</th>
                <th className="p-4 text-left">Produto</th>
                <th className="p-4 text-left">Categoria</th>
                <th className="p-4 text-right">Preço</th>
                <th className="p-4 text-left">Status</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {dndTabela.itensVisiveis.map((p, i) => (
                <tr
                  key={p.id}
                  ref={dndTabela.registrar(p.id)}
                  className={cn(
                    "border-b border-border/50",
                    dndTabela.idArrastando === p.id && "bg-secondary/60 opacity-70",
                  )}
                >
                  <td className="p-4">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <button
                        type="button"
                        aria-label={`Arrastar ${p.name} para outra posição`}
                        className="rounded p-1 hover:bg-secondary"
                        {...dndTabela.arrastarProps(p.id)}
                      >
                        <GripVertical className="h-4 w-4" />
                      </button>
                      <span className="text-xs tabular-nums">{i + 1}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {p.image_url ? <img src={p.image_url} alt="" className="h-10 w-10 rounded-md object-cover" /> : <div className="h-10 w-10 rounded-md bg-muted" />}
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="line-clamp-1 text-xs text-muted-foreground">{p.description}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-muted-foreground">{p.category}</td>
                  <td className="p-4 text-right">{formatBRL(Number(p.price))}</td>
                  <td className="p-4">
                    <Badge variant={p.active ? "default" : "secondary"}>{p.active ? "Ativo" : "Inativo"}</Badge>
                  </td>
                  <td className="p-4 text-right">
                    <Button variant="ghost" size="sm" disabled={i === 0 || reordering} onClick={() => move(i, -1)} title="Subir"><ArrowUp className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" disabled={i === list.length - 1 || reordering} onClick={() => move(i, 1)} title="Descer"><ArrowDown className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => toggle(p)}><Power className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleting(p)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
              {!isLoading && list.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum produto cadastrado ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Mobile: cards */}
        <div className="divide-y divide-border/50 md:hidden">
          {dndCards.itensVisiveis.map((p, i) => (
            <div
              key={p.id}
              ref={dndCards.registrar(p.id)}
              className={cn(
                "flex items-start gap-3 p-4",
                dndCards.idArrastando === p.id && "bg-secondary/60 opacity-70",
              )}
            >
              <button
                type="button"
                aria-label={`Arrastar ${p.name} para outra posição`}
                className="mt-1 shrink-0 rounded p-1 text-muted-foreground hover:bg-secondary"
                {...dndCards.arrastarProps(p.id)}
              >
                <GripVertical className="h-5 w-5" />
              </button>
              {p.image_url ? (
                <img src={p.image_url} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover" />
              ) : (
                <div className="h-14 w-14 shrink-0 rounded-md bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.category}</div>
                  </div>
                  <div className="text-right text-sm font-medium">{formatBRL(Number(p.price))}</div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <Badge variant={p.active ? "default" : "secondary"}>{p.active ? "Ativo" : "Inativo"}</Badge>
                  <div className="flex items-center">
                    <Button variant="ghost" size="sm" disabled={i === 0 || reordering} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" disabled={i === list.length - 1 || reordering} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => toggle(p)}><Power className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleting(p)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {!isLoading && list.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhum produto cadastrado ainda.</div>
          )}
        </div>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar produto" : "Novo produto"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="mt-1" />
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
                <Label>Foto</Label>
                <div className="mt-1 flex items-center gap-2">
                  <Input value={editing.image_url ?? ""} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} placeholder="https://... ou envie um arquivo" />
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickFile} />
                  <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                    <Upload className="mr-1 h-4 w-4" /> {uploading ? "Enviando…" : "Enviar"}
                  </Button>
                </div>
                {editing.image_url && <img src={editing.image_url} alt="" className="mt-2 h-24 w-24 rounded-md object-cover" />}
              </div>
              {editing.id ? (
                <div className="rounded-lg border p-3">
                  <Label htmlFor="posicao">Posição no catálogo</Label>
                  <div className="mt-1 flex items-center gap-3">
                    <Input
                      id="posicao"
                      type="number"
                      min={1}
                      max={list.length}
                      className="w-24"
                      value={editing.display_order ?? ""}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          display_order: e.target.value === "" ? undefined : Number(e.target.value),
                        })
                      }
                    />
                    <span className="text-xs text-muted-foreground">de {list.length}</span>
                  </div>
                  {(() => {
                    const v = vizinhos(editing.id, editing.display_order ?? 0);
                    if (!v) return null;
                    if (!v.antes && !v.depois) return null;
                    return (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {v.antes ? <>Vai aparecer depois de <strong>{v.antes}</strong></> : <>Vai aparecer em primeiro</>}
                        {v.depois ? <> e antes de <strong>{v.depois}</strong>.</> : <> e em último.</>}
                      </p>
                    );
                  })()}
                  <p className="mt-1 text-xs text-muted-foreground">
                    A ordem vale para o catálogo inteiro. Ao filtrar por categoria, os produtos
                    seguem essa mesma sequência.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Produtos novos entram no fim do catálogo. Depois de salvar você pode arrastar
                  ou mudar a posição por aqui.
                </p>
              )}
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

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o produto <strong>{deleting?.name}</strong>? Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && remove(deleting)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}
