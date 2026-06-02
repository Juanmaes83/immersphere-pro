# CaptureJob / ProcessingJob - Status Flow

Este flujo describe estados funcionales. No obliga a implementarlos todos desde el primer dia. En Fase 0 pueden vivir en una tabla o checklist manual.

## Diagrama textual

```text
draft
  -> received
  -> assets_review
  -> needs_more_material -> assets_review
  -> ready_for_processing
  -> processing_manual
  -> processing_lab
  -> qa_review
  -> client_review
  -> approved
  -> published
  -> connected_to_crm
  -> archived

failed / cancelled pueden aparecer desde cualquier fase operativa.
```

## Estados

| Estado | Que significa | Quien lo mueve | Siguiente estado posible | Condicion de avance | Riesgo tipico |
| --- | --- | --- | --- | --- | --- |
| `draft` | Job creado pero todavia incompleto. | Comercial u operaciones. | `received`, `cancelled` | Hay cliente, objetivo y tipo de proyecto. | Crear jobs sin contexto suficiente. |
| `received` | Solicitud o material inicial recibido. | Comercial. | `assets_review`, `needs_more_material` | Se registra el origen y material disponible. | El cliente cree que ya esta todo listo. |
| `assets_review` | Revision inicial de calidad, permisos y utilidad. | Produccion o QA. | `needs_more_material`, `ready_for_processing`, `failed` | Checklist minimo revisado. | Material inutilizable o sin derechos claros. |
| `needs_more_material` | Falta material, permisos o informacion. | Produccion, comercial o cliente. | `assets_review`, `cancelled` | Cliente entrega lo pendiente. | Bloqueo por falta de respuesta. |
| `ready_for_processing` | El job esta preparado para trabajar. | Operaciones. | `processing_manual`, `processing_lab` | Material suficiente y objetivo claro. | Subestimar horas o complejidad. |
| `processing_manual` | Trabajo manual o asistido: landing, viewer, QR, informe, preparacion. | Produccion. | `qa_review`, `failed` | Entregable interno listo. | Errores manuales o alcance poco definido. |
| `processing_lab` | Prueba controlada con herramientas experimentales o PoC. | Lab o perfil tecnico. | `qa_review`, `failed`, `archived` | Resultado usable o aprendizaje documentado. | Confundir experimento con produccion. |
| `qa_review` | Revision de calidad antes de ensenar o publicar. | QA, produccion o responsable de producto. | `client_review`, `processing_manual`, `failed` | Checklist aprobado. | Saltarse movil, carga o privacidad. |
| `client_review` | Cliente revisa demo, landing, viewer o informe. | Comercial. | `approved`, `needs_more_material`, `processing_manual`, `cancelled` | Feedback recibido y resuelto. | Feedback ambiguo o cambios fuera de alcance. |
| `approved` | Cliente o responsable aprueba el entregable. | Comercial o responsable de cuenta. | `published`, `connected_to_crm`, `archived` | Aprobacion registrada. | Aprobar sin confirmar derechos o version final. |
| `published` | Activo publicado o listo para compartir. | Produccion. | `connected_to_crm`, `archived` | URL, QR o viewer accesible. | Enlace roto, CTA ausente o analitica sin activar. |
| `connected_to_crm` | Resultado conectado con lead, propuesta, actividad o seguimiento. | Comercial. | `archived` | Se crea actividad y siguiente accion. | Publicar sin seguimiento comercial. |
| `archived` | Job cerrado, terminado o guardado para historico. | Operaciones. | Ninguno, salvo reapertura futura. | No hay accion pendiente. | Archivar sin aprendizajes o metricas. |
| `failed` | El job falla por material, tecnica, alcance o bloqueo. | Produccion u operaciones. | `assets_review`, `needs_more_material`, `archived` | Se documenta causa y decision. | No explicar al comercial que se puede rescatar. |
| `cancelled` | Job cancelado por cliente, prioridad o decision interna. | Comercial u operaciones. | `archived` | Motivo registrado. | Perder trazabilidad de oportunidad futura. |

## Reglas de avance recomendadas

- Ningun job pasa a `published` sin pasar por `qa_review`.
- Todo `needs_more_material` debe tener `nextAction` y responsable.
- Todo `failed` debe guardar motivo y recomendacion.
- Todo `published` debe generar evento comercial.
- Todo `connected_to_crm` debe registrar proxima accion o cierre.
