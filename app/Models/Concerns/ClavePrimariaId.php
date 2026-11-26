<?php

namespace App\Models\Concerns;

/**
 * Convención de la BD FEDER: la clave primaria de cada tabla se llama id_<tabla> (id_pedido, id_usuario...).
 *
 * - Si el modelo no declara otra clave, usa id_<tabla> como $primaryKey.
 * - Expone el atributo virtual "id" (= la clave primaria): el código PHP puede seguir usando $modelo->id
 *   y el JSON de la API sigue trayendo "id", así el frontend no cambia.
 * - Los modelos con clave compuesta ($primaryKey = null) o con otra clave (p. ej. usuario_id) no se tocan.
 */
trait ClavePrimariaId
{
    public function initializeClavePrimariaId(): void
    {
        if ($this->primaryKey !== 'id') {
            return;
        }

        $this->primaryKey = 'id_'.$this->getTable();
        $this->guarded = array_map(fn ($c) => $c === 'id' ? $this->primaryKey : $c, $this->guarded);
        $this->append('id');
    }

    public function getIdAttribute(): mixed
    {
        return $this->getKey();
    }
}
