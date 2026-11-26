!INC Local Scripts.EAConstants-JScript

/*
 * ===================================================================
 *  FEDER - INF513 (Proyecto 2, versión web)
 *  Diagramas de secuencia de DISEÑO de los casos de uso CU1..CU8
 * -------------------------------------------------------------------
 *  Lenguaje: JScript (Enterprise Architect)
 *  Uso: selecciona en el Project Browser el paquete destino,
 *       Specialize > Scripting > nuevo script JScript, pega y ejecuta.
 *       Crea (o recrea) "Diagramas de Secuencia - FEDER" con una carpeta
 *       por CU: objetos «boundary» / «control» / «entity» + [sd].
 *
 *  Estilo:
 *   - máximo 6 participantes por diagrama (actor, vista, controlador/servicio, entidades);
 *   - la operación principal del CU primero; los errores o alternativas
 *     al final, en un marco alt (puede tener varios operandos);
 *   - un opt/alt dentro del flujo principal solo si queda separado del
 *     siguiente marco por al menos un mensaje (EA no deja espacio extra);
 *   - mensajes como operaciones; respuestas punteadas (ret: true).
 *
 *  EA espacia los mensajes por su cuenta a distancia fija: los marcos se
 *  ubican con yMsg(n). Si un marco no encierra bien sus mensajes, ajusta
 *  MSG_Y0 / MSG_DY (medidos en una captura del propio EA).
 *
 *  Basado en: routes/api.php, app/Http/Controllers/Api/*, app/Services/*,
 *  resources/js/paginas/*.
 * ===================================================================
 */

var NOMBRE_RAIZ = "Diagramas de Secuencia - FEDER";

// ---- Medidas -------------------------------------------------------
var X0      = 40;     // borde izquierdo del primer participante
var Y_TOP   = 40;
var OBJ_H   = 60;
var ACT_W   = 40, ACT_H = 70;
var MSG_Y0  = 134;    // y del primer mensaje
var MSG_DY  = 35.7;   // separación entre mensajes que usa EA (medida en la captura de CU1)
var CHAR_W  = 6.3;    // ancho aproximado de un carácter en las etiquetas
var PAD_FRAG = 60;    // margen horizontal del marco respecto a sus mensajes

// Subtipos de InteractionFragment en EA
var SUBTIPO = { "alt": 0, "opt": 1, "break": 2, "par": 3, "loop": 4 };

// ---- Casos de uso --------------------------------------------------
// participantes: tipo = actor | boundary | control | entity
// mensajes: { de, a, texto, ret }   (ret: true = respuesta punteada)
// fragmentos: { tipo, operandos: [{ guarda (sin corchetes), desde, hasta }] }  (números de mensaje, desde 1)
var CUS = [
  // ---------------------------------------------------------------- CU1
  {
    codigo: "CU1", nombre: "Gestionar usuarios, roles y permisos",
    participantes: [
      { id: "adm", nombre: "Administrador",     tipo: "actor"    },
      { id: "ui",  nombre: "UIUsuarios",        tipo: "boundary" },
      { id: "ctl", nombre: "UsuarioController", tipo: "control"  },
      { id: "rol", nombre: "Rol",               tipo: "entity"   },
      { id: "usu", nombre: "Usuario",           tipo: "entity"   }
    ],
    mensajes: [
      { de: "adm", a: "ui",  texto: "registrarUsuario(datos)" },                          // 1
      { de: "ui",  a: "ui",  texto: "validarFormulario(datos)" },                         // 2
      { de: "ui",  a: "ctl", texto: "crear(datos)" },                                     // 3
      { de: "ctl", a: "rol", texto: "existe(rolId)" },                                    // 4
      { de: "ctl", a: "usu", texto: "existeEmailOCi(email, ci)" },                        // 5
      { de: "ctl", a: "ctl", texto: "cifrarContrasena(password)" },                       // 6
      { de: "ctl", a: "usu", texto: "crear(datos, estado = activo)" },                    // 7
      { de: "ctl", a: "ui",  texto: "respuesta(usuario)", ret: true },                    // 8
      { de: "ui",  a: "adm", texto: "mostrar(\"Usuario registrado\")", ret: true },       // 9
      { de: "ctl", a: "ui",  texto: "error(\"El email o CI ya está registrado\")", ret: true }, // 10
      { de: "ui",  a: "adm", texto: "mostrarErrores()", ret: true }                       // 11
    ],
    fragmentos: [
      { tipo: "alt", operandos: [{ guarda: "email o CI ya registrado", desde: 10, hasta: 11 }] }
    ]
  },

  // ---------------------------------------------------------------- CU2
  {
    codigo: "CU2", nombre: "Gestionar productores y comunidades",
    participantes: [
      { id: "per", nombre: "Personal",                 tipo: "actor"    },
      { id: "ui",  nombre: "UIEmprendimientos",        tipo: "boundary" },
      { id: "ctl", nombre: "EmprendimientoController", tipo: "control"  },
      { id: "img", nombre: "ImagenServicio",           tipo: "control"  },
      { id: "usu", nombre: "Usuario",                  tipo: "entity"   },
      { id: "emp", nombre: "Emprendimiento",           tipo: "entity"   }
    ],
    mensajes: [
      { de: "per", a: "ui",  texto: "registrarProductor(datos, imagen)" },               // 1
      { de: "ui",  a: "ctl", texto: "crear(datos)" },                                     // 2
      { de: "ctl", a: "usu", texto: "esProductor(usuarioId)" },                           // 3
      { de: "ctl", a: "emp", texto: "existePorProductor(usuarioId)" },                    // 4
      { de: "ctl", a: "emp", texto: "crear(datos)" },                                     // 5
      { de: "ctl", a: "ui",  texto: "respuesta(emprendimiento)", ret: true },             // 6
      { de: "ui",  a: "ctl", texto: "subirImagen(id, imagen)" },                          // 7
      { de: "ctl", a: "img", texto: "guardar(imagen, carpeta)" },                         // 8
      { de: "img", a: "ctl", texto: "ruta(webp)", ret: true },                            // 9
      { de: "ctl", a: "emp", texto: "actualizarImagen(ruta)" },                           // 10
      { de: "ctl", a: "ui",  texto: "respuesta(emprendimiento)", ret: true },             // 11
      { de: "ui",  a: "per", texto: "mostrar(\"Productor registrado\")", ret: true },     // 12
      { de: "ctl", a: "ui",  texto: "error(\"El usuario no es Productor o ya tiene emprendimiento\")", ret: true }, // 13
      { de: "ui",  a: "per", texto: "mostrarError()", ret: true }                         // 14
    ],
    fragmentos: [
      { tipo: "alt", operandos: [{ guarda: "no es Productor o ya tiene emprendimiento", desde: 13, hasta: 14 }] }
    ]
  },

  // ---------------------------------------------------------------- CU3
  {
    codigo: "CU3", nombre: "Gestionar producción, lotes y trazabilidad",
    participantes: [
      { id: "per",  nombre: "Personal",             tipo: "actor"    },
      { id: "ui",   nombre: "UIProduccion",         tipo: "boundary" },
      { id: "ctl",  nombre: "LoteController",       tipo: "control"  },
      { id: "prod", nombre: "Produccion",           tipo: "entity"   },
      { id: "lote", nombre: "Lote",                 tipo: "entity"   },
      { id: "mov",  nombre: "MovimientoInventario", tipo: "entity"   }
    ],
    mensajes: [
      { de: "per",  a: "ui",   texto: "ingresarLote(produccionId, codigo, cantidad, costo)" }, // 1
      { de: "ui",   a: "ctl",  texto: "crear(datos)" },                                  // 2
      { de: "ctl",  a: "prod", texto: "obtener(produccionId)" },                         // 3
      { de: "prod", a: "ctl",  texto: "produccion(estado, cantidad)", ret: true },       // 4
      { de: "ctl",  a: "lote", texto: "cantidadIngresada(produccionId)" },               // 5
      { de: "lote", a: "ctl",  texto: "total(cantidad)", ret: true },                    // 6
      { de: "ctl",  a: "lote", texto: "ingresar(produccion, codigo, cantidad, costo)" }, // 7
      { de: "ctl",  a: "mov",  texto: "registrarEntrada(lote, cantidad)" },              // 8
      { de: "ctl",  a: "ctl",  texto: "revisarStockMinimo(producto)" },                  // 9
      { de: "ctl",  a: "ui",   texto: "respuesta(lote)", ret: true },                    // 10
      { de: "ui",   a: "per",  texto: "mostrar(\"Lote ingresado\")", ret: true },        // 11
      { de: "ctl",  a: "ui",   texto: "error(\"La producción no está validada\")", ret: true },   // 12
      { de: "ui",   a: "per",  texto: "mostrarError()", ret: true },                     // 13
      { de: "ctl",  a: "ui",   texto: "error(\"La cantidad excede lo producido\")", ret: true },  // 14
      { de: "ui",   a: "per",  texto: "mostrarError()", ret: true }                      // 15
    ],
    fragmentos: [
      { tipo: "alt", operandos: [
          { guarda: "producción no validada",            desde: 12, hasta: 13 },
          { guarda: "la cantidad supera lo producido",   desde: 14, hasta: 15 }
      ] }
    ]
  },

  // ---------------------------------------------------------------- CU4
  {
    codigo: "CU4", nombre: "Gestionar catálogo, inventario y alertas",
    participantes: [
      { id: "per", nombre: "Personal",             tipo: "actor"    },
      { id: "ui",  nombre: "UIInventario",         tipo: "boundary" },
      { id: "ctl", nombre: "InventarioController", tipo: "control"  },
      { id: "lote",nombre: "Lote",                 tipo: "entity"   },
      { id: "mov", nombre: "MovimientoInventario", tipo: "entity"   },
      { id: "ale", nombre: "AlertaInventario",     tipo: "entity"   }
    ],
    mensajes: [
      { de: "per", a: "ui",   texto: "registrarMovimiento(loteId, tipo, cantidad)" },     // 1
      { de: "ui",  a: "ctl",  texto: "registrarMovimiento(datos, version)" },             // 2
      { de: "ctl", a: "lote", texto: "obtener(loteId)" },                                 // 3
      { de: "lote",a: "ctl",  texto: "lote(stock, version)", ret: true },                 // 4
      { de: "ctl", a: "ctl",  texto: "calcularNuevoStock(tipo, cantidad)" },              // 5
      { de: "ctl", a: "lote", texto: "actualizarStock(nuevoStock, estado)" },             // 6
      { de: "ctl", a: "mov",  texto: "crear(lote, tipo, cantidad)" },                     // 7
      { de: "ctl", a: "ctl",  texto: "revisarStockMinimo(producto)" },                    // 8
      { de: "ctl", a: "ale",  texto: "crear(stock_bajo, mensaje)" },                      // 9
      { de: "ctl", a: "ui",   texto: "respuesta(lote)", ret: true },                      // 10
      { de: "ui",  a: "per",  texto: "mostrar(\"Movimiento registrado\")", ret: true },   // 11
      { de: "ctl", a: "ui",   texto: "error(\"El lote fue modificado por otro usuario\")", ret: true }, // 12
      { de: "ui",  a: "per",  texto: "mostrarError()", ret: true },                       // 13
      { de: "ctl", a: "ui",   texto: "error(\"El stock no puede quedar negativo\")", ret: true },       // 14
      { de: "ui",  a: "per",  texto: "mostrarError()", ret: true }                        // 15
    ],
    fragmentos: [
      { tipo: "opt", operandos: [{ guarda: "stock por debajo del mínimo", desde: 9, hasta: 9 }] },
      { tipo: "alt", operandos: [
          { guarda: "versión del lote desactualizada", desde: 12, hasta: 13 },
          { guarda: "el stock quedaría negativo",       desde: 14, hasta: 15 }
      ] }
    ]
  },

  // ---------------------------------------------------------------- CU5
  {
    codigo: "CU5", nombre: "Comprar con carrito y encargos",
    participantes: [
      { id: "cli", nombre: "Cliente",           tipo: "actor"    },
      { id: "ui",  nombre: "UICarrito",         tipo: "boundary" },
      { id: "ctl", nombre: "CarritoController", tipo: "control"  },
      { id: "srv", nombre: "PedidoServicio",    tipo: "control"  },
      { id: "ped", nombre: "Pedido",            tipo: "entity"   },
      { id: "lote",nombre: "Lote",              tipo: "entity"   }
    ],
    mensajes: [
      { de: "cli", a: "ui",   texto: "confirmarCompra(entrega, nit, razonSocial)" },      // 1
      { de: "ui",  a: "ctl",  texto: "confirmar(datos)" },                                // 2
      { de: "ctl", a: "ped",  texto: "obtenerCarrito(cliente)" },                         // 3
      { de: "ped", a: "ctl",  texto: "carrito(detalles)", ret: true },                    // 4
      { de: "ctl", a: "srv",  texto: "reservarYEntregar(pedido, entrega)" },              // 5
      { de: "srv", a: "lote", texto: "verificarDisponibilidad(productos)" },              // 6
      { de: "srv", a: "srv",  texto: "calcularCostoEnvio(distancia)" },                   // 7
      { de: "srv", a: "lote", texto: "reservar(pedido, 24 h)" },                          // 8
      { de: "srv", a: "ped",  texto: "registrarEntrega(tipo, direccion)" },               // 9
      { de: "srv", a: "ctl",  texto: "reservaConfirmada()", ret: true },                  // 10
      { de: "ctl", a: "ped",  texto: "recalcularTotal()" },                               // 11
      { de: "ctl", a: "ctl",  texto: "notificar(cliente, personal)" },                    // 12
      { de: "ctl", a: "ui",   texto: "respuesta(pedido)", ret: true },                    // 13
      { de: "ui",  a: "cli",  texto: "mostrar(\"Compra confirmada\")", ret: true },       // 14
      { de: "srv", a: "ctl",  texto: "error(\"No hay stock suficiente\")", ret: true },   // 15
      { de: "ctl", a: "ui",   texto: "error(\"No hay stock suficiente\")", ret: true },   // 16
      { de: "ui",  a: "cli",  texto: "mostrarError()", ret: true }                        // 17
    ],
    fragmentos: [
      { tipo: "opt", operandos: [{ guarda: "entrega a domicilio", desde: 7, hasta: 7 }] },
      { tipo: "alt", operandos: [{ guarda: "stock insuficiente", desde: 15, hasta: 17 }] }
    ]
  },

  // ---------------------------------------------------------------- CU6
  {
    codigo: "CU6", nombre: "Gestionar pedidos, pagos y entregas",
    participantes: [
      { id: "cli", nombre: "Cliente",        tipo: "actor"    },
      { id: "ui",  nombre: "UIPago",         tipo: "boundary" },
      { id: "ctl", nombre: "PagoController", tipo: "control"  },
      { id: "srv", nombre: "PagoServicio",   tipo: "control"  },
      { id: "pas", nombre: "PasarelaPago",   tipo: "boundary" },
      { id: "pag", nombre: "Pago",           tipo: "entity"   }
    ],
    mensajes: [
      { de: "cli", a: "ui",  texto: "pagar(pedidoId, metodo, monto)" },                   // 1
      { de: "ui",  a: "ctl", texto: "pagar(pedidoId, datos)" },                           // 2
      { de: "ctl", a: "ctl", texto: "verificarSaldo(pedido, monto)" },                    // 3
      { de: "ctl", a: "srv", texto: "procesar(pedido, metodo, monto)" },                  // 4
      { de: "srv", a: "pas", texto: "cobrar(datos)" },                                    // 5
      { de: "pas", a: "srv", texto: "resultado(estado, clientSecret)", ret: true },       // 6
      { de: "srv", a: "pag", texto: "crear(pedido, monto, estado)" },                     // 7
      { de: "srv", a: "srv", texto: "despuesDePago(pago, estado)" },                      // 8
      { de: "srv", a: "ctl", texto: "resultadoPago()", ret: true },                       // 9
      { de: "ctl", a: "ui",  texto: "respuesta(pago)", ret: true },                       // 10
      { de: "ui",  a: "cli", texto: "mostrar(\"Pago registrado\")", ret: true },          // 11
      { de: "ui",  a: "cli", texto: "solicitarAutenticacion3DS(clientSecret)" },          // 12
      { de: "ui",  a: "ctl", texto: "confirmar(pagoId)" },                                // 13
      { de: "ctl", a: "ui",  texto: "respuesta(pago)", ret: true },                       // 14
      { de: "ctl", a: "ui",  texto: "error(\"Pago rechazado\")", ret: true },             // 15
      { de: "ui",  a: "cli", texto: "mostrarError()", ret: true }                         // 16
    ],
    fragmentos: [
      { tipo: "alt", operandos: [
          { guarda: "la tarjeta requiere 3D Secure", desde: 12, hasta: 14 },
          { guarda: "pago rechazado",                desde: 15, hasta: 16 }
      ] }
    ]
  },

  // ---------------------------------------------------------------- CU7
  {
    codigo: "CU7", nombre: "Consultar indicadores financieros",
    participantes: [
      { id: "adm", nombre: "Administrador",      tipo: "actor"    },
      { id: "ui",  nombre: "UIFinanzas",         tipo: "boundary" },
      { id: "ctl", nombre: "FinanzasController", tipo: "control"  },
      { id: "ped", nombre: "Pedido",             tipo: "entity"   },
      { id: "pag", nombre: "Pago",               tipo: "entity"   },
      { id: "lote",nombre: "Lote",               tipo: "entity"   }
    ],
    mensajes: [
      { de: "adm", a: "ui",   texto: "consultarIndicadores(desde, hasta)" },              // 1
      { de: "ui",  a: "ctl",  texto: "indicadores(desde, hasta)" },                       // 2
      { de: "ctl", a: "ctl",  texto: "usarUltimos30Dias()" },                             // 3
      { de: "ctl", a: "ped",  texto: "ventasDelPeriodo(desde, hasta)" },                  // 4
      { de: "ped", a: "ctl",  texto: "ventas()", ret: true },                             // 5
      { de: "ctl", a: "pag",  texto: "cobrosDelPeriodo(desde, hasta)" },                  // 6
      { de: "pag", a: "ctl",  texto: "cobrado()", ret: true },                            // 7
      { de: "ctl", a: "ped",  texto: "saldoPorCobrar()" },                                // 8
      { de: "ctl", a: "lote", texto: "margenYValorInventario()" },                        // 9
      { de: "lote",a: "ctl",  texto: "margen(valorInventario)", ret: true },              // 10
      { de: "ctl", a: "ctl",  texto: "calcularIndicadores()" },                           // 11
      { de: "ctl", a: "ui",   texto: "respuesta(indicadores)", ret: true },               // 12
      { de: "ui",  a: "ui",   texto: "dibujarGraficos(indicadores)" },                    // 13
      { de: "ui",  a: "adm",  texto: "mostrar(panelFinanciero)", ret: true },             // 14
      { de: "ctl", a: "ui",   texto: "error(\"Rango de fechas inválido\")", ret: true },  // 15
      { de: "ui",  a: "adm",  texto: "mostrarError()", ret: true }                        // 16
    ],
    fragmentos: [
      { tipo: "opt", operandos: [{ guarda: "no se indicó el periodo", desde: 3, hasta: 3 }] },
      { tipo: "alt", operandos: [{ guarda: "fecha desde posterior a hasta", desde: 15, hasta: 16 }] }
    ]
  },

  // ---------------------------------------------------------------- CU8
  {
    codigo: "CU8", nombre: "Generar reportes y estadísticas",
    participantes: [
      { id: "adm", nombre: "Administrador",     tipo: "actor"    },
      { id: "ui",  nombre: "UIReportes",        tipo: "boundary" },
      { id: "ctl", nombre: "ReporteController", tipo: "control"  },
      { id: "ped", nombre: "Pedido",            tipo: "entity"   },
      { id: "pag", nombre: "Pago",              tipo: "entity"   }
    ],
    mensajes: [
      { de: "adm", a: "ui",  texto: "generarReporte(tipo, desde, hasta)" },               // 1
      { de: "ui",  a: "ctl", texto: "generar(tipo, desde, hasta)" },                      // 2
      { de: "ctl", a: "ctl", texto: "validarTipo(tipo)" },                                // 3
      { de: "ctl", a: "ped", texto: "ventasPorProducto(desde, hasta)" },                  // 4
      { de: "ped", a: "ctl", texto: "filas()", ret: true },                               // 5
      { de: "ctl", a: "pag", texto: "ingresosPorDia(desde, hasta)" },                     // 6
      { de: "pag", a: "ctl", texto: "filas()", ret: true },                               // 7
      { de: "ctl", a: "ctl", texto: "consultaAgregada(tipo, desde, hasta)" },             // 8
      { de: "ctl", a: "ctl", texto: "armarReporte(columnas, filas, grafico)" },           // 9
      { de: "ctl", a: "ui",  texto: "respuesta(reporte)", ret: true },                    // 10
      { de: "ui",  a: "ui",  texto: "dibujarTablaYGrafico(reporte)" },                    // 11
      { de: "ui",  a: "adm", texto: "mostrar(reporte)", ret: true },                      // 12
      { de: "ctl", a: "ui",  texto: "error(\"Reporte no encontrado\")", ret: true },      // 13
      { de: "ui",  a: "adm", texto: "mostrarError()", ret: true }                         // 14
    ],
    fragmentos: [
      { tipo: "alt", operandos: [
          { guarda: "tipo = ventas",   desde: 4, hasta: 5 },
          { guarda: "tipo = ingresos", desde: 6, hasta: 7 },
          { guarda: "otro tipo",       desde: 8, hasta: 8 }
      ] },
      { tipo: "alt", operandos: [{ guarda: "tipo de reporte no válido", desde: 13, hasta: 14 }] }
    ]
  }
];

// Qué CU generar (vacío = todos). Ej.: ["CU1"]
var SOLO = [];

// ===================================================================
function log(m) { Session.Output(m); }
function yMsg(n) { return Math.round(MSG_Y0 + (n - 1) * MSG_DY); }
function anchoTexto(t) { return Math.round(t.length * CHAR_W); }

function buscarPaquete(padre, nombre) {
  for (var i = 0; i < padre.Packages.Count; i++) {
    var p = padre.Packages.GetAt(i);
    if (p.Name == nombre) return p;
  }
  return null;
}
function obtenerPaquete(padre, nombre) {
  var p = buscarPaquete(padre, nombre);
  if (p == null) {
    p = padre.Packages.AddNew(nombre, "");
    p.Update();
    padre.Packages.Refresh();
  }
  return p;
}
function borrarPaquete(padre, nombre) {
  for (var i = padre.Packages.Count - 1; i >= 0; i--) {
    if (padre.Packages.GetAt(i).Name == nombre) padre.Packages.DeleteAt(i, true);
  }
  padre.Packages.Refresh();
}
function colocar(diag, elementId, l, t, r, b) {
  l = Math.round(l); r = Math.round(r); t = Math.round(t); b = Math.round(b);
  var o = diag.DiagramObjects.AddNew("l=" + l + ";r=" + r + ";t=" + t + ";b=" + b + ";", "");
  o.ElementID = elementId;
  o.Update();
  return o;
}

// EA dibuja boundary / control / entity con su ícono (círculos) y no deja cambiarlo a
// rectángulo. Con un espacio no separable al final, EA ya no reconoce el estereotipo:
// lo dibuja como rectángulo y el texto se sigue leyendo «boundary», «control», «entity».
var ESPACIO_DURO = String.fromCharCode(160);
function estereotipoRectangulo(tipo) { return tipo + ESPACIO_DURO; }

// ---- Validación (antes de tocar el modelo) -------------------------
function validarCU(CU) {
  var ids = {};
  for (var i = 0; i < CU.participantes.length; i++) ids[CU.participantes[i].id] = true;
  for (var m = 0; m < CU.mensajes.length; m++) {
    var msg = CU.mensajes[m];
    if (!ids[msg.de] || !ids[msg.a])
      throw new Error(CU.codigo + ": el mensaje " + (m + 1) + " usa un participante inexistente");
  }
  var fr = CU.fragmentos || [];
  for (var f = 0; f < fr.length; f++) {
    var ops = fr[f].operandos;
    if (SUBTIPO[fr[f].tipo] == null) throw new Error(CU.codigo + ": tipo de marco desconocido " + fr[f].tipo);
    for (var k = 0; k < ops.length; k++) {
      if (ops[k].desde < 1 || ops[k].hasta > CU.mensajes.length || ops[k].desde > ops[k].hasta)
        throw new Error(CU.codigo + ": rango inválido en el marco " + (f + 1));
      if (k > 0 && ops[k].desde != ops[k - 1].hasta + 1)
        throw new Error(CU.codigo + ": los operandos del marco " + (f + 1) + " deben ser consecutivos");
    }
    if (f > 0) {
      var finAnterior = fr[f - 1].operandos[fr[f - 1].operandos.length - 1].hasta;
      if (ops[0].desde - finAnterior < 2)
        throw new Error(CU.codigo + ": entre el marco " + f + " y el " + (f + 1) +
                        " debe quedar al menos un mensaje (EA no deja espacio extra)");
    }
  }
}

// ---- Posiciones horizontales ---------------------------------------
function calcularColumnas(CU) {
  var n = CU.participantes.length, idx = {}, w = [], i;
  for (i = 0; i < n; i++) {
    var p = CU.participantes[i];
    idx[p.id] = i;
    w.push(p.tipo == "actor" ? ACT_W : Math.max(110, Math.round(p.nombre.length * 7.2) + 24));
  }
  // distancia entre centros vecinos: la caja más ancha o la etiqueta más larga
  var d = [];
  for (i = 0; i < n - 1; i++) d.push(Math.max(170, (w[i] + w[i + 1]) / 2 + 50));
  var largos = [];
  for (var m = 0; m < CU.mensajes.length; m++) {
    var msg = CU.mensajes[m], a = idx[msg.de], b = idx[msg.a];
    var necesita = anchoTexto(msg.texto) + 40;
    if (a == b) { if (a < n - 1) d[a] = Math.max(d[a], necesita + 30); continue; }
    var lo = Math.min(a, b), hi = Math.max(a, b);
    if (hi == lo + 1) d[lo] = Math.max(d[lo], necesita);
    else largos.push([lo, hi, necesita]);
  }
  var cx = centros(w, d);
  for (var k = 0; k < largos.length; k++) {
    var actual = cx[largos[k][1]] - cx[largos[k][0]];
    if (actual < largos[k][2]) {
      var extra = (largos[k][2] - actual) / (largos[k][1] - largos[k][0]);
      for (i = largos[k][0]; i < largos[k][1]; i++) d[i] += extra;
      cx = centros(w, d);
    }
  }
  return { idx: idx, w: w, cx: cx };
}
function centros(w, d) {
  var cx = [X0 + w[0] / 2];
  for (var i = 1; i < w.length; i++) cx.push(cx[i - 1] + d[i - 1]);
  return cx;
}

// ---- Generación ----------------------------------------------------
function generarCU(CU, raiz) {
  validarCU(CU);
  var col = calcularColumnas(CU);
  var nombreCarpeta = CU.codigo + " - " + CU.nombre;
  log("--- " + nombreCarpeta);
  var pkg = obtenerPaquete(raiz, nombreCarpeta);

  // Participantes: actor o Object con estereotipo (rectángulo, ver estereotipoRectangulo)
  var el = {};
  for (var i = 0; i < CU.participantes.length; i++) {
    var p = CU.participantes[i], e;
    if (p.tipo == "actor") {
      e = pkg.Elements.AddNew(p.nombre, "Actor");
    } else {
      e = pkg.Elements.AddNew(p.nombre, "Object");
      e.Stereotype = estereotipoRectangulo(p.tipo);
    }
    e.Update();
    el[p.id] = e;
  }
  pkg.Elements.Refresh();

  // Diagrama
  var diag = pkg.Diagrams.AddNew("Diseñar Caso de Uso " + CU.codigo, "Sequence");
  diag.Update();
  pkg.Diagrams.Refresh();
  var s = diag.ExtendedStyle;
  if (s.indexOf("HideQuals=") >= 0) s = s.replace(/HideQuals=\d/, "HideQuals=1");
  else s = s + "HideQuals=1;";
  diag.ExtendedStyle = s;
  diag.Update();

  for (var k = 0; k < CU.participantes.length; k++) {
    var pp = CU.participantes[k], c = col.cx[k], w = col.w[k];
    var h = (pp.tipo == "actor") ? ACT_H : OBJ_H;
    colocar(diag, el[pp.id].ElementID, c - w / 2, Y_TOP, c + w / 2, Y_TOP + h);
  }
  diag.DiagramObjects.Refresh();

  // Mensajes (EA los espacia solo, en orden de SequenceNo)
  for (var m = 0; m < CU.mensajes.length; m++) {
    var msg = CU.mensajes[m];
    var o = el[msg.de], d = el[msg.a];
    var cn = o.Connectors.AddNew(msg.texto, "Sequence");
    cn.SupplierID = d.ElementID;
    cn.DiagramID = diag.DiagramID;
    cn.SequenceNo = m + 1;
    cn.Update();
    o.Connectors.Refresh();
    // llamada sincrónica / respuesta punteada
    Repository.Execute("UPDATE t_connector SET PDATA1='Synchronous', PDATA4='" + (msg.ret ? "1" : "0") +
                       "' WHERE Connector_ID=" + cn.ConnectorID);
  }

  // Marcos alt / opt
  var fr = CU.fragmentos || [];
  for (var f = 0; f < fr.length; f++) crearMarco(CU, col, pkg, diag, fr[f]);

  diag.Update();
  Repository.ReloadDiagram(diag.DiagramID);
  log("  participantes: " + CU.participantes.length + ", mensajes: " + CU.mensajes.length +
      ", marcos: " + fr.length);
  return diag;
}

function crearMarco(CU, col, pkg, diag, fr) {
  var ops = fr.operandos;
  var desde = ops[0].desde, hasta = ops[ops.length - 1].hasta;

  // Extensión horizontal: los mensajes que encierra (+ etiqueta de auto-mensajes)
  var minX = 1e9, maxX = -1e9;
  for (var q = desde - 1; q < hasta; q++) {
    var mm = CU.mensajes[q], a = col.cx[col.idx[mm.de]], b = col.cx[col.idx[mm.a]];
    minX = Math.min(minX, a, b);
    maxX = Math.max(maxX, a, b);
    if (mm.de == mm.a) maxX = Math.max(maxX, a + 30 + anchoTexto(mm.texto));
  }
  var guardaMax = 0;
  for (var g = 0; g < ops.length; g++) guardaMax = Math.max(guardaMax, anchoTexto(ops[g].guarda) + 20);
  var l = minX - PAD_FRAG;
  var r = Math.max(maxX + PAD_FRAG, l + guardaMax + 80);

  // Extensión vertical: desde arriba del primer mensaje hasta abajo del último
  var t = yMsg(desde) - 30;
  var b2 = yMsg(hasta) + 20;

  var frag = pkg.Elements.AddNew("", "InteractionFragment");
  frag.Subtype = SUBTIPO[fr.tipo];
  frag.Alias = fr.tipo + " " + ops[0].guarda;   // para reconocerlo en el Project Browser
  frag.Update();
  try {
    for (var k = 0; k < ops.length; k++) {
      var arriba = (k == 0) ? t : Math.round((yMsg(ops[k - 1].hasta) + yMsg(ops[k].desde)) / 2);
      var abajo = (k == ops.length - 1) ? b2 : Math.round((yMsg(ops[k].hasta) + yMsg(ops[k + 1].desde)) / 2);
      var part = frag.Partitions.AddNew(ops[k].guarda, "Partition");
      part.Size = abajo - arriba;
    }
    frag.Update();
  } catch (eP) { log("  ! no se pudieron crear los operandos: " + eP.message); }
  pkg.Elements.Refresh();

  colocar(diag, frag.ElementID, l, t, r, b2);
  try {
    Repository.Execute("UPDATE t_diagramobjects SET RectLeft=" + Math.round(l) + ", RectRight=" + Math.round(r) +
                       ", RectTop=" + (-t) + ", RectBottom=" + (-b2) +
                       " WHERE Diagram_ID=" + diag.DiagramID + " AND Object_ID=" + frag.ElementID);
  } catch (eS) {}
  log("  " + fr.tipo + " [" + ops[0].guarda + "]: mensajes " + desde + " a " + hasta);
}

function main() {
  Repository.EnsureOutputVisible("Script");
  Repository.ClearOutput("Script");
  log("=== Diagramas de secuencia - FEDER ===");

  var seleccionado = Repository.GetTreeSelectedPackage();
  if (seleccionado == null) {
    Session.Prompt("Selecciona un paquete antes de ejecutar el script.", promptOK);
    return;
  }

  // Validar todo antes de borrar nada
  for (var v = 0; v < CUS.length; v++) validarCU(CUS[v]);

  var raiz;
  if (SOLO.length == 0) {
    borrarPaquete(seleccionado, NOMBRE_RAIZ);
    raiz = obtenerPaquete(seleccionado, NOMBRE_RAIZ);
  } else {
    raiz = obtenerPaquete(seleccionado, NOMBRE_RAIZ);
  }

  var ultimo = null;
  for (var i = 0; i < CUS.length; i++) {
    if (SOLO.length > 0 && ("|" + SOLO.join("|") + "|").indexOf("|" + CUS[i].codigo + "|") < 0) continue;
    borrarPaquete(raiz, CUS[i].codigo + " - " + CUS[i].nombre);
    ultimo = generarCU(CUS[i], raiz);
  }

  Repository.RefreshModelView(raiz.PackageID);
  if (ultimo != null) Repository.OpenDiagram(ultimo.DiagramID);
  log("=== Listo ===");
}

main();
