import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

type ComId = { id?: string };

/**
 * Arrastar e soltar para reordenar listas do painel.
 *
 * Feito com Pointer Events em vez de uma biblioteca de drag and drop porque o
 * projeto não tem nenhuma instalada e a API de HTML5 drag (`draggable`) não
 * dispara no toque — e o painel é usado principalmente pelo celular.
 *
 * A lista da tela é reordenada na hora (`itensVisiveis`) e só depois o servidor
 * é avisado, senão o item volta para o lugar antigo por um instante enquanto a
 * requisição acontece.
 *
 * Chame um hook por superfície (tabela do desktop e cards do mobile têm
 * markup próprio): cada instância guarda os próprios elementos, e a superfície
 * escondida por CSS tem altura zero, então não interfere na que está visível.
 */
export function useArrastarOrdem<T extends ComId>(
  itens: T[],
  /** Recebe o id do item e a posição final, 1-based. Deve resolver só depois de recarregar a lista. */
  aoSoltar: (id: string, posicao: number) => Promise<void>,
) {
  const [previa, setPrevia] = useState<T[] | null>(null);
  const [idArrastando, setIdArrastando] = useState<string | null>(null);
  const elementos = useRef(new Map<string, HTMLElement>());
  const previaRef = useRef<T[] | null>(null);
  // Espelho do estado em ref: o primeiro pointermove pode chegar antes do
  // re-render que publicaria `idArrastando` nos handlers.
  const idRef = useRef<string | null>(null);

  const itensVisiveis = previa ?? itens;

  function aplicarPrevia(lista: T[] | null) {
    previaRef.current = lista;
    setPrevia(lista);
  }

  /** ref da linha/card, para saber onde cada item está na tela. */
  function registrar(id?: string) {
    return (el: HTMLElement | null) => {
      if (!id) return;
      if (el) elementos.current.set(id, el);
      else elementos.current.delete(id);
    };
  }

  /** Espalhe no punho de arrastar: <button {...arrastarProps(p.id)}>. */
  function arrastarProps(id?: string) {
    if (!id) return {};
    return {
      // Sem isso o navegador rola a página em vez de deixar arrastar no toque.
      style: { touchAction: "none" as const, cursor: "grab" },
      onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        idRef.current = id;
        setIdArrastando(id);
        aplicarPrevia(itens);
      },
      onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
        const base = previaRef.current;
        const emArraste = idRef.current;
        if (!base || !emArraste) return;
        const de = base.findIndex((i) => i.id === emArraste);
        if (de < 0) return;

        // Índice sob o dedo/cursor. Itens sem elemento medido (ou com altura
        // zero, caso da superfície escondida por CSS) são ignorados.
        let para = de;
        base.forEach((item, i) => {
          const el = item.id ? elementos.current.get(item.id) : null;
          if (!el) return;
          const r = el.getBoundingClientRect();
          if (r.height === 0) return;
          if (e.clientY >= r.top && e.clientY <= r.bottom) para = i;
        });
        if (para === de) return;

        const nova = [...base];
        const [movido] = nova.splice(de, 1);
        nova.splice(para, 0, movido);
        aplicarPrevia(nova);
      },
      onPointerUp: async (e: ReactPointerEvent<HTMLElement>) => {
        e.currentTarget.releasePointerCapture(e.pointerId);
        const base = previaRef.current;
        const arrastado = idRef.current;
        idRef.current = null;
        setIdArrastando(null);
        if (!base || !arrastado) return aplicarPrevia(null);

        const destino = base.findIndex((i) => i.id === arrastado);
        const origem = itens.findIndex((i) => i.id === arrastado);
        if (destino < 0 || destino === origem) return aplicarPrevia(null);

        try {
          await aoSoltar(arrastado, destino + 1);
        } finally {
          // Só agora: a lista do servidor já chegou com a ordem nova, então
          // largar a prévia não pisca.
          aplicarPrevia(null);
        }
      },
      onPointerCancel: () => {
        idRef.current = null;
        setIdArrastando(null);
        aplicarPrevia(null);
      },
    };
  }

  return { itensVisiveis, idArrastando, registrar, arrastarProps };
}
