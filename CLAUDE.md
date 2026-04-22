# LP-Hub — Notas para o Claude

## Brave Browser: Konva.js Hit Detection Fix

### Problema
Brave's canvas fingerprinting protection randomises `getImageData()` pixel values.
Konva.js usa `getImageData()` para identificar qual shape está sob o cursor (hit canvas).
Resultado: `stage.getIntersection()` sempre retorna `null` no Brave → nenhum shape é "encontrado" → eventos de drag/click nunca disparam em shapes colocados no canvas.

**Sintomas:**
- Placement funciona (não precisa de hit test)
- Tokens colocados (agentes, habilidades) não respondem a clique, hover ou drag
- Diamantes de rotação/resize também não respondem

**NÃO funciona:** `hitFunc` em `Konva.Group` — ainda passa pelo mesmo sistema de hit canvas.

### Solução: Patch geométrico em `stage.getIntersection`

Localização: `frontend/manager/strategy-board.html`, dentro de `initKonva()`, logo após os `stage.on(...)`.

```js
// ── Brave canvas-fingerprinting workaround ─────────────────────────────
// Brave randomises getImageData(), breaking Konva's pixel-based hit test.
// We patch getIntersection() to fall back to pure-math geometry for agent /
// ability tokens AND their rot-handle diamonds whenever the native pixel
// lookup returns nothing.
(function() {
    const _origGI = stage.getIntersection.bind(stage);
    stage.getIntersection = function(pos) {
        const native = _origGI(pos);
        if (native) return native;
        // Convert stage-space → world coordinates (accounts for pan/zoom)
        const wx = (pos.x - stage.x()) / stage.scaleX();
        const wy = (pos.y - stage.y()) / stage.scaleY();
        // Walk drawLayer children top-to-bottom (last = topmost visually)
        const nodes = drawLayer.getChildren();
        for (let i = nodes.length - 1; i >= 0; i--) {
            const n = nodes[i];
            if (!n.listening() || !n.isVisible()) continue;
            const t = n.getAttr('_type');
            if (t !== 'agent' && t !== 'ability') continue;

            // ── rot-handle diamond (checked first — sits on top visually)
            const handle = n.findOne('.rot-handle');
            if (handle && handle.listening() && handle.isVisible()) {
                // handle.x() / handle.y() are local to the group;
                // rotate them by the group's rotation to get world offset.
                const rot = n.rotation() * Math.PI / 180;
                const hx = n.x() + handle.x() * Math.cos(rot) - handle.y() * Math.sin(rot);
                const hy = n.y() + handle.x() * Math.sin(rot) + handle.y() * Math.cos(rot);
                const hdx = wx - hx, hdy = wy - hy;
                if (hdx * hdx + hdy * hdy <= 12 * 12) return handle;
            }

            // ── center circle (main body of token)
            const r = t === 'agent' ? 26 : 22;
            const dx = wx - n.x(), dy = wy - n.y();
            if (dx * dx + dy * dy <= r * r) {
                // Return the Circle child so Konva dispatches events on it;
                // they bubble up to the draggable parent group automatically.
                return n.findOne('Circle') || n;
            }
        }
        return null;
    };
})();
```

### Princípios da solução

1. **Fallback, não substituição**: `if (native) return native` — Chrome/Firefox continuam usando o hit canvas nativo normalmente.
2. **Coordenadas world**: `pos` em `getIntersection` é stage-space; converter com `(pos.x - stage.x()) / stage.scaleX()` para world coords (suporta pan/zoom).
3. **Ordem**: handle primeiro (visualmente no topo), depois o círculo central.
4. **Retorna shape filho**: retornar `Circle` filho em vez do grupo faz os eventos borbulharem (`bubble`) até o grupo pai que tem `draggable` e handlers.
5. **Rot-handle**: posição do diamante = `(handle.x(), handle.y())` em local coords do grupo → aplicar rotação do grupo via `cos/sin` para obter world coords.
6. **`hitFunc` em Group NÃO funciona** como alternativa — sobreescreve o hit canvas dos filhos, quebrando a detecção.

### Debounce de placement (`_lastPlaceTime`)

Problema secundário relacionado: double-placement quando Konva click E DOM click ambos disparam.

- `_lastPlaceTime = Date.now()` setado dentro do handler `onClick` do Konva
- Native DOM fallback (`#konva-wrap` click listener) verifica `Date.now() - _lastPlaceTime < 200` antes de colocar
- **NUNCA colocar debounce dentro de `placeAgent`** — quebra `restoreObjects` que chama `await placeAgent()` em loop sequencial (imagens em cache HTTP carregam em < 1ms, todas cairiam dentro da janela de debounce)

### Cache de API (carregamento lento no Brave)

Brave bloqueia/atrasa requests para APIs externas. Solução: localStorage com TTL de 24h para respostas da Valorant API.

```js
const _CACHE_TTL = 24 * 60 * 60 * 1000;
function _cacheGet(key) { /* localStorage get com TTL check */ }
function _cacheSet(key, data) { /* localStorage set com timestamp */ }
// loadMaps() e loadAgents() checam _cacheGet('vapi_maps') / _cacheGet('vapi_agents') antes de fetch
```
