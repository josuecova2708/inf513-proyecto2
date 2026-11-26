<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/** CU6: QR de cobro de FEDER (imagen guardada en BD, como en el 1er parcial). */
class QrController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(DB::table('qr_pago as q')->leftJoin('usuario as u', 'u.id_usuario', '=', 'q.usuario_id')
            ->orderByDesc('q.id_qr_pago')
            ->get(['q.id_qr_pago as id', 'q.nombre_archivo', 'q.tipo_mime', 'q.fecha', 'q.activo', DB::raw("u.nombre || ' ' || u.apellido AS subido_por")]));
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate(['imagen' => ['required', 'image', 'mimes:png,jpg,jpeg', 'max:2048']], ['imagen.max' => 'La imagen no puede pesar más de 2 MB.']);
        $f = $request->file('imagen');
        DB::transaction(function () use ($f, $request) {
            DB::table('qr_pago')->update(['activo' => false]);
            DB::insert('INSERT INTO qr_pago (imagen, tipo_mime, nombre_archivo, usuario_id) VALUES (decode(?, \'base64\'), ?, ?, ?)', [
                base64_encode(file_get_contents($f->getRealPath())), $f->getMimeType(), mb_substr($f->getClientOriginalName(), 0, 120), $request->user()->id,
            ]);
        });

        return $this->mensaje('QR de cobro actualizado. Los clientes verán la nueva imagen al pagar.', [], 201);
    }

    /** Imagen del QR activo. Si no hay uno cargado, devuelve un QR de demostración (SVG). */
    public function imagen(): Response
    {
        $qr = DB::selectOne("SELECT encode(imagen, 'base64') AS b64, tipo_mime FROM qr_pago WHERE activo ORDER BY id_qr_pago DESC LIMIT 1");
        if ($qr) {
            return response(base64_decode($qr->b64), 200, ['Content-Type' => $qr->tipo_mime, 'Cache-Control' => 'no-cache']);
        }

        return response($this->qrDemo(), 200, ['Content-Type' => 'image/svg+xml', 'Cache-Control' => 'no-cache']);
    }

    private function qrDemo(): string
    {
        mt_srand(28);
        $n = 25;
        $celdas = '';
        $esFinder = fn ($x, $y) => ($x < 7 && $y < 7) || ($x >= $n - 7 && $y < 7) || ($x < 7 && $y >= $n - 7);
        for ($y = 0; $y < $n; $y++) {
            for ($x = 0; $x < $n; $x++) {
                if ($esFinder($x, $y)) {
                    continue;
                }
                if (mt_rand(0, 1)) {
                    $celdas .= '<rect x="'.$x.'" y="'.$y.'" width="1" height="1"/>';
                }
            }
        }
        $finder = fn ($x, $y) => '<rect x="'.$x.'" y="'.$y.'" width="7" height="7"/><rect x="'.($x + 1).'" y="'.($y + 1).'" width="5" height="5" fill="#fff"/><rect x="'.($x + 2).'" y="'.($y + 2).'" width="3" height="3"/>';

        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 29 33" width="260" height="296"><rect x="-2" y="-2" width="29" height="33" fill="#fff"/><g fill="#1d2a21">'
            .$celdas.$finder(0, 0).$finder($n - 7, 0).$finder(0, $n - 7)
            .'</g><text x="12.5" y="29.5" font-size="2" text-anchor="middle" font-family="Arial" fill="#2f6b3f">QR DEMO FEDER</text></svg>';
    }
}
