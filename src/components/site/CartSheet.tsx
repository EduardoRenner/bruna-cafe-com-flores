import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { formatBRL } from "@/lib/products";

export function CartSheet() {
  const { items, open, setOpen, setQty, remove, subtotal } = useCart();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">Seu carrinho</SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-secondary/60 text-rose-deep">
              <ShoppingBag className="h-7 w-7" />
            </div>
            <p className="text-muted-foreground">Seu carrinho está vazio.</p>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Continuar comprando
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6">
              <ul className="divide-y divide-border">
                {items.map((item) => (
                  <li key={item.id} className="flex gap-3 py-4">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                      {item.image && (
                        <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-sm text-rose-deep">{formatBRL(item.price)}</p>
                        </div>
                        <button
                          onClick={() => remove(item.id)}
                          aria-label="Remover"
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-2 inline-flex items-center overflow-hidden rounded-md border border-border">
                        <button
                          className="grid h-7 w-7 place-items-center hover:bg-muted"
                          onClick={() => setQty(item.id, item.quantity - 1)}
                          aria-label="Diminuir"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center text-sm">{item.quantity}</span>
                        <button
                          className="grid h-7 w-7 place-items-center hover:bg-muted"
                          onClick={() => setQty(item.id, item.quantity + 1)}
                          aria-label="Aumentar"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <SheetFooter className="border-t border-border p-6">
              <div className="w-full space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold">{formatBRL(subtotal)}</span>
                </div>
                <Link to="/checkout" onClick={() => setOpen(false)}>
                  <Button className="w-full bg-rose-deep text-primary-foreground" size="lg">
                    Finalizar pedido
                  </Button>
                </Link>
                <Button variant="ghost" className="w-full" onClick={() => setOpen(false)}>
                  <X className="mr-2 h-4 w-4" /> Continuar comprando
                </Button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
