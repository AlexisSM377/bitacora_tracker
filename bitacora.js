
      // --- CONFIG Y ESTADO GLOBAL (Variables de entorno) ---
      const API_KEY = "AIzaSyDtA5bl8XuclA92cz2f-eCswuWQul87f0I"; // Para Google Sheets
      const SPREADSHEET_ID = "1XwjnIxq98oStetgaD5XDWpfgUhMCR1dgCzY8eVa3tiE";
      const RANGE = "BITACORA!A1:S944";

      // Roles de Usuario
      const USER_ROLES = {
        editor: {
          username: "user",
          password: "editor",
          tabs: [0, 1, 2, 3, 4, 5, 6],
        }, // Acceso total (0-6)
        lector: { username: "view", password: "read", tabs: [3, 4, 5, 6] }, // Solo pestañas 4, 5, 6, 7 (índice 3, 4, 5, 6)
      };

      // Variables globales (sin Firebase): rol y control local
      let userRole = null; // 'editor' o 'lector'

      // Lógica de Login (Mantenida)
      function handleLogin(event) {
        event.preventDefault();
        const form = event.target;
        const username = form.username.value.trim();
        const password = form.password.value.trim();
        const errorEl = document.getElementById("login-error-message");
        errorEl.classList.add("hidden");

        let foundRole = null;
        for (const role in USER_ROLES) {
          if (
            USER_ROLES[role].username === username &&
            USER_ROLES[role].password === password
          ) {
            foundRole = role;
            break;
          }
        }

        if (foundRole) {
          userRole = foundRole;
          document.getElementById("login-modal").classList.add("hidden");
          updateTabVisibility(userRole);
          // updateTabVisibility() ya navega a la primera pestaña permitida
        } else {
          errorEl.textContent = "Usuario o contraseña incorrectos.";
          errorEl.classList.remove("hidden");
        }
      }
      window.handleLogin = handleLogin;

      // Control de Visibilidad de Pestañas (Mantenida)
      function updateTabVisibility(role) {
        const allowedTabs = USER_ROLES[role].tabs;
        for (let i = 0; i < 7; i++) {
          const btn = document.getElementById(`tab-btn-${i}`);
          const content = document.getElementById(`tab-${i}`);

          if (btn) {
            btn.classList.toggle("hidden", !allowedTabs.includes(i));
          }
          if (content && !allowedTabs.includes(i)) {
            content.classList.add("hidden");
          }
        }
        // Forzar a la primera pestaña permitida
        if (allowedTabs.length > 0) {
          changeTab(allowedTabs[0]);
        }
      }

      window.onload = function () {
        // Sin Firebase: cargamos datos desde Google Sheets y dejamos que los informes
        // se consulten a demanda vía PHP/MySQL.
        try {
          const status = document.getElementById("db-status");
          if (status)
            status.textContent = "Estado de la Base de Datos: MySQL (vía PHP)";
        } catch (e) {}

        window.loadDataFromGoogleSheets(true);
        setInterval(() => window.loadDataFromGoogleSheets(false), 300000);
      };

      // Exponer funciones necesarias al ámbito global (window)
      window.loadDataFromGoogleSheets = loadDataFromGoogleSheets;
      window.filterByDate = filterByDate;
      window.renderAllTabs = renderAllTabs;
      window.handleUnidadSelection = handleUnidadSelection;
      window.showUnitData = showUnitData;
      window.saveSeguimiento = saveSeguimiento;
      window.addIncidencia = addIncidencia;
      window.renderRegistroDespacho = renderRegistroDespacho;
      window.filterAndRenderKPIs = filterAndRenderKPIs;
      window.filterAndRenderInforme = filterAndRenderInforme;
      window.exportUpdatedSheet = exportUpdatedSheet;
      window.changeTab = changeTab;
      window.closeModal = closeModal;
      window.handleGpsValidationChange = handleGpsValidationChange;
      window.downloadWordReport = downloadWordReport;
      window.downloadReportAsExcel = downloadReportAsExcel;
      window.guardarInformeEnBD = guardarInformeEnBD;
      window.cargarInformesGuardados = cargarInformesGuardados;
      window.verInformeDetalle = verInformeDetalle;
      window.eliminarInforme = eliminarInforme;
      window.mostrarInformes = mostrarInformes; // Expuesto para usar en setupReportsListener
      window.applyInformesFilters = applyInformesFilters;
      window.resetInformesFilters = resetInformesFilters;
      window.showProtocoloIncidenciaFromSelect =
        showProtocoloIncidenciaFromSelect;
      // Funciones de emergencia 911
      window.openEmergency911Modal = openEmergency911Modal;
      window.openEmergencyContactsModal = openEmergencyContactsModal;
      window.applyEmergency911Filters = applyEmergency911Filters;
      window.loadMoreEmergency911Rows = loadMoreEmergency911Rows;
      window.deleteIncidencia = deleteIncidencia;

      // --- CONFIG Y ESTADO GLOBAL (Datos) ---
      // En hosting a veces el CDN del plugin puede fallar; no queremos que eso rompa TODO el JS.
      try {
        if (window.Chart && window.ChartDataLabels) {
          Chart.register(ChartDataLabels);
        } else if (window.Chart && !window.ChartDataLabels) {
          console.warn(
            "ChartDataLabels no está disponible; se omite Chart.register(ChartDataLabels)."
          );
        }
      } catch (e) {
        console.warn("No se pudo registrar ChartDataLabels:", e);
      }
      let allDespachosData = [],
        filteredDespachosData = [],
        folioCounter = 1,
        charts = {},
        kpiVehicleData = {},
        lastInformeData = [],
        informesGuardadosCache = [];

      // Las funciones helper de fecha se mantienen igual

      // --- Helpers de fecha ---
      function excelDateToYYYYMMDD(value) {
        if (!value) return dayjs().format("YYYY-MM-DD");
        if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
          return value;
        const parsedDash = dayjs(String(value), "DD-MM-YYYY");
        if (parsedDash.isValid()) return parsedDash.format("YYYY-MM-DD");
        const parsedSlash = dayjs(String(value), "DD/MM/YYYY");
        if (parsedSlash.isValid()) return parsedSlash.format("YYYY-MM-DD");
        if (value instanceof Date && !isNaN(value))
          return dayjs.utc(value).format("YYYY-MM-DD");
        return dayjs().format("YYYY-MM-DD");
      }

      function parseExcelDateTime(timeValue, dateValue) {
        if (!timeValue) return "";
        const fullDateTimeFormats = [
          "DD-MM-YYYY HH:mm:ss",
          "DD/MM/YYYY HH:mm:ss",
          "DD-MM-YYYY HH:mm",
          "DD/MM/YYYY HH:mm",
        ];
        let parsedDate = dayjs(String(timeValue), fullDateTimeFormats, true);
        if (!parsedDate.isValid()) {
          const mainDate = dayjs(
            String(dateValue),
            ["DD-MM-YYYY", "DD/MM/YYYY"],
            true
          );
          if (mainDate.isValid()) {
            const timeMatch = String(timeValue).match(
              /(\d{1,2}):(\d{2})(?::(\d{2}))?/
            );
            if (timeMatch) {
              const hours = parseInt(timeMatch[1], 10);
              const minutes = parseInt(timeMatch[2], 10);
              const seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
              parsedDate = mainDate.hour(hours).minute(minutes).second(seconds);
            }
          }
        }
        return parsedDate.isValid() ? parsedDate.toISOString() : "";
      }

      function formatDateTime(d) {
        return d && dayjs(d).isValid()
          ? dayjs(d).format("DD/MM/YYYY HH:mm")
          : "N/A";
      }

      function formatForInput(isoString) {
        if (!isoString) return "";
        try {
          const parsed = dayjs(isoString);
          if (!parsed.isValid()) return "";
          return parsed.format("YYYY-MM-DDTHH:mm");
        } catch (e) {
          return "";
        }
      }

      function checkTimeDeviation(prog, real) {
        if (!prog || !real) return "task-cell";
        const progDate = dayjs(prog);
        const realDate = dayjs(real);
        if (!progDate.isValid() || !realDate.isValid()) return "task-cell";
        const diff = realDate.diff(progDate, "minute");
        return diff > 10 ? "estatus-rojo" : "estatus-verde";
      }

      // --- Carga de Google Sheets (Mantenida) ---
      async function loadDataFromGoogleSheets(isInitialLoad = true) {
        const container = document.getElementById("datos-generales-container");
        if (isInitialLoad) {
          container.innerHTML = `<div class="col-span-full text-center p-10 bg-white rounded-xl shadow"><h3 class="text-lg font-medium text-gray-700">Cargando datos...</h3><p class="text-gray-500 mt-2">Conectando con Google Sheets.</p></div>`;
        }
        try {
          const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`;
          const response = await fetch(url);
          const apiResponse = await response.json();
          if (!response.ok)
            throw new Error(
              apiResponse.error
                ? apiResponse.error.message
                : "Error de conexión."
            );
          if (!apiResponse.values || apiResponse.values.length === 0)
            throw new Error(
              `El RANGO ('${RANGE}') está vacío o es incorrecto.`
            );
          const jsonData = convertSheetDataToObjects(apiResponse.values);
          processData(jsonData);
        } catch (error) {
          container.innerHTML = `<div class="col-span-full text-center p-10 bg-white rounded-xl shadow"><h3 class="text-lg font-medium text-red-700">Error Crítico</h3><p class="mt-4 bg-red-50 p-3 rounded-md text-left"><strong>Detalle:</strong> ${error.message}</p></div>`;
        }
      }

      // --- Convertir Sheet a objetos (Mantenida) ---
      function normalizeSheetHeader(value) {
        if (value === null || value === undefined) return "";
        return String(value)
          .trim()
          .toLowerCase()
          // Quitar acentos/diacríticos (teléfono -> telefono)
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          // Unificar separadores a _ ("GPS Validación Estado" -> "gps_validacion_estado")
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "");
      }

      function convertSheetDataToObjects(data) {
        if (data.length < 2) return [];
        const headers = data.shift().map((h) => normalizeSheetHeader(h));
        return data
          .map((row) => {
            const obj = {};
            headers.forEach((header, index) => {
              if (header) obj[header] = row[index] || "";
            });
            return obj;
          })
          .filter((row) => row.unidad && String(row.unidad).trim() !== "");
      }

      // --- Procesar datos (Mantenida) ---
      function processData(data) {
        // Mantener datos guardados en localStorage cuando existan
        let savedData = null;
        try {
          const local = localStorage.getItem("bitacoraData");
          if (local) savedData = JSON.parse(local);
        } catch (e) {
          localStorage.removeItem("bitacoraData");
        }
        const savedMap = new Map();
        if (savedData && Array.isArray(savedData)) {
          savedData.forEach((d) => {
            const key = `${d.folio}-${d.unidad}-${d.fechaProgramada}`;
            savedMap.set(key, d);
          });
        }

        folioCounter = 1;
        const newAll = data.map((row) => {
          const fechaProg = excelDateToYYYYMMDD(row["fecha"]);
          const despacho = {
            folio: row["folio"] || folioCounter++,
            fechaProgramada: fechaProg,
            unidad: row["unidad"] || "N/A",
            placas: row["placas"] || "N/A",
            operador: row["operador"] || "N/A",
            telefono: row["telefono"] || "N/A",
            ruta: row["ruta"] || "N/A",
            origen: row["origen"] || "N/A",
            destino: row["destino"] || "N/A",
            citaSalidaUnidad: parseExcelDateTime(
              row["salida_prog"],
              row["fecha"]
            ),
            citaCarga: parseExcelDateTime(row["carga_prog"], row["fecha"]),
            citaSalida: parseExcelDateTime(
              row["salida_carga_prog"],
              row["fecha"]
            ),
            citaDescarga: parseExcelDateTime(
              row["descarga_prog"],
              row["fecha"]
            ),
            realSalidaUnidad: "",
            realCarga: "",
            realSalida: "",
            realDescarga: "",
            realConfirmacionEntrega: "",
            confirmacionEntrega: null,
            estatus: "Programado",
            incidencias: [],
            observaciones: "",
            observacionesTimestamp: "",
            // Nuevos campos
            operadorMonitoreoId: row["operador_monitoreo"] || "",
            gpsValidacionEstado: row["gps_validacion_estado"] || "",
            gpsValidacionTimestamp: row["gps_validacion_timestamp"] || "",
          };
          const key = `${despacho.folio}-${despacho.unidad}-${despacho.fechaProgramada}`;
          if (savedMap.has(key)) {
            const saved = savedMap.get(key);
            Object.assign(despacho, saved);
          }
          return despacho;
        });

        allDespachosData = newAll;
        saveAllData();

        const dateFilter = document.getElementById("date-filter");
        if (!dateFilter.value) setDefaultDate(dateFilter);
        filterByDate();
      }

      function saveAllData() {
        try {
          localStorage.setItem(
            "bitacoraData",
            JSON.stringify(allDespachosData)
          );
        } catch (e) {
          console.error("Error saving data", e);
        }
      }

      function setDefaultDate(dateFilter) {
        if (!dateFilter) return;
        if (allDespachosData.length > 0) {
          const allDates = [
            ...new Set(
              allDespachosData
                .map((d) => d.fechaProgramada)
                .filter((d) => d && dayjs(d, "YYYY-MM-DD").isValid())
            ),
          ];
          allDates.sort((a, b) =>
            dayjs(b, "YYYY-MM-DD").diff(dayjs(a, "YYYY-MM-DD"))
          );
          dateFilter.value =
            allDates.length > 0 ? allDates[0] : dayjs().format("YYYY-MM-DD");
        } else {
          dateFilter.value = dayjs().format("YYYY-MM-DD");
        }
      }

      function filterByDate() {
        const selectedDate = document.getElementById("date-filter").value;
        filteredDespachosData = allDespachosData.filter(
          (d) => d.fechaProgramada === selectedDate
        );
        renderAllTabs();
      }

      // --- Render de todas las pestañas (Mantenida) ---
      function renderAllTabs() {
        renderDatosGenerales();
        renderOrigenDestino();
        populateUnidadSelector();
        populateRegistroFilter();
        renderRegistroDespacho();
        filterAndRenderKPIs("selectedDate");
        filterAndRenderInforme("selectedDate");
      }

      function renderDatosGenerales() {
        const container = document.getElementById("datos-generales-container");
        container.innerHTML = "";
        if (filteredDespachosData.length === 0) {
          container.innerHTML = `<div class="col-span-full text-center p-10 bg-white rounded-xl shadow"><h3 class="text-lg">No hay despachos para esta fecha</h3></div>`;
          return;
        }
        filteredDespachosData.forEach((d) => {
          container.innerHTML += `<div class="bg-white p-5 rounded-xl shadow-lg border border-gray-100"><div class="flex justify-between items-start mb-3"><div><h3 class="font-bold text-lg text-blue-800">${d.unidad}</h3><p class="text-sm text-gray-500">${d.placas}</p></div><span class="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">Folio: ${String(
            d.folio
          ).padStart(
            3,
            "0"
          )}</span></div><div class="space-y-2 text-sm"><p><strong>Operador:</strong> ${
            d.operador
          }</p><p><strong>Ruta:</strong> ${
            d.ruta
          }</p><p><strong>Destino:</strong> ${d.destino}</p></div></div>`;
        });
      }

      // --- Pestaña 2: Origen/Destino con hipervínculos a Google Maps (Mantenida) ---
      function renderOrigenDestino() {
        const container = document.getElementById("origen-destino-container");
        container.innerHTML = "";
        if (filteredDespachosData.length === 0) {
          container.innerHTML = `<div class="col-span-full text-center p-10 bg-white rounded-xl shadow"><h3 class="text-lg">Sin datos de rutas</h3></div>`;
          return;
        }
        filteredDespachosData.forEach((d) => {
          const origenUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            d.origen || ""
          )}`;
          const destinoUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            d.destino || ""
          )}`;
          container.innerHTML += `
            <div class="bg-white p-5 rounded-xl shadow border">
              <h3 class="font-bold text-lg text-blue-800">${d.unidad}</h3>
              <p class="text-sm text-gray-500">${d.ruta}</p>
              <p class="text-sm mt-2">
                <strong>Origen:</strong>
                <a href="${origenUrl}" target="_blank" class="map-link">${
                  d.origen || "No especificado"
                }</a>
              </p>
              <p class="text-sm">
                <strong>Destino:</strong>
                <a href="${destinoUrl}" target="_blank" class="map-link">${
                  d.destino || "No especificado"
                }</a>
              </p>
            </div>`;
        });
      }

      // --- POBLAR SELECTOR DE UNIDADES (Mantenida) ---
      function populateUnidadSelector() {
        const sel = document.getElementById("unidad-selector");
        sel.innerHTML = '<option value="">-- Seleccione unidad --</option>';
        filteredDespachosData.forEach((d, i) => {
          sel.innerHTML += `<option value="${i}">${d.unidad}</option>`;
        });
        document.getElementById("consulta-btn").disabled = true;
        sel.onchange = (ev) => handleUnidadSelection(ev);
      }

      function handleUnidadSelection(event) {
        const index = event.target.value;
        const consultaBtn = document.getElementById("consulta-btn");
        if (index === "" || index === null) {
          document
            .getElementById("seguimiento-form-container")
            .classList.add("hidden");
          consultaBtn.disabled = true;
          return;
        }
        consultaBtn.disabled = false;
        renderSeguimientoForm(Number(index));
      }

      // --- Pestaña 3: Seguimiento Detallado (Mantenida) ---
      function renderSeguimientoForm(index) {
        const container = document.getElementById("seguimiento-form-container");
        const despacho = filteredDespachosData[index];
        if (!despacho) {
          container.innerHTML = "<p>No hay datos para esta unidad.</p>";
          container.classList.remove("hidden");
          return;
        }

        // El rol debe ser 'editor' para permitir la edición de campos y guardar
        const isEditor = userRole === "editor";
        const disabledAttr = isEditor ? "" : "disabled";
        const readOnlyAttr = isEditor ? "" : "readonly";

        // MODIFICACIÓN: Nuevas opciones de incidencia
        const incidenciaOptions = `
          <optgroup label="🔴 Críticas (Rojo)">
            <option>Desconexión de batería</option>
            <option>Botón de pánico</option>
            <option>Persecución</option>
            <option>Accidente vehicular propio</option>
            <option>Robo o asalto</option>
          </optgroup>

          <optgroup label="🟠 Relevantes (Naranja)">
            <option>Ausencia de actualización</option>
            <option>Parada no autorizada</option>
            <option>Operador no contesta más de 2 veces</option>
            <option>Detención por faltas al reglamento de tránsito</option>
            <option>Falla mecánica</option>
            <option>Ponchadura de llantas</option>
            <option>Cierres carreteros</option>
            <option>Condiciones climatológicas</option>
            <option>Sin contacto con el operador</option>
            <option>Desvío de ruta</option>
            <option>Vehículo sospechoso</option>
          </optgroup>

          <optgroup label="🟢 Ordinarias (Verde)">
            <option>Salida a destiempo</option>
            <option>Desconocimiento de lugar de entrega</option>
            <option>Mala actitud del Operador</option>
          </optgroup>
        `;

        container.innerHTML = `
          <form id="form-seguimiento" class="space-y-6">
            <!-- SECCIÓN SUPERIOR: OPERADOR & VALIDACIÓN GPS -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 justify-items-center text-center">
              <!-- ID del Operador de Monitoreo -->
              <div class="bg-gray-50 border rounded-xl px-4 py-3 w-full max-w-md shadow-sm">
                <label class="block text-sm font-semibold text-gray-700 mb-2">
                  ID del Operador de Monitoreo
                </label>
                <select
                  name="operadorMonitoreoId"
                  class="mt-1 w-full max-w-xs mx-auto p-2 border rounded-md"
                  ${disabledAttr}
                >
                  <option value="">-- Seleccione --</option>
                  <option value="GEO-01" ${
                    despacho.operadorMonitoreoId === "GEO-01" ? "selected" : ""
                  }>GEO-01</option>
                  <option value="GEO-02" ${
                    despacho.operadorMonitoreoId === "GEO-02" ? "selected" : ""
                  }>GEO-02</option>
                  <option value="GEO-03" ${
                    despacho.operadorMonitoreoId === "GEO-03" ? "selected" : ""
                  }>GEO-03</option>
                  <option value="GEO-04" ${
                    despacho.operadorMonitoreoId === "GEO-04" ? "selected" : ""
                  }>GEO-04</option>
                  <option value="GEO-05" ${
                    despacho.operadorMonitoreoId === "GEO-05" ? "selected" : ""
                  }>GEO-05</option>
                  <option value="GEO-06" ${
                    despacho.operadorMonitoreoId === "GEO-06" ? "selected" : ""
                  }>GEO-06</option>
                </select>
              </div>

              <!-- Validación de Funcionamiento del GPS y accesorios -->
              <div class="bg-gray-50 border rounded-xl px-4 py-3 w-full max-w-md shadow-sm">
                <label class="block text-sm font-semibold text-gray-700 mb-2">
                  Validación de Funcionamiento del GPS y accesorios
                </label>
                <select
                  name="gpsValidacionEstado"
                  class="mt-1 w-full max-w-xs mx-auto p-2 border rounded-md"
                  onchange="window.handleGpsValidationChange(${index}, this)"
                  ${disabledAttr}
                >
                  <option value="">-- Seleccione --</option>
                  <option value="Operativo" ${
                    despacho.gpsValidacionEstado === "Operativo"
                      ? "selected"
                      : ""
                  }>Operativo</option>
                  <option value="No Operativo" ${
                    despacho.gpsValidacionEstado === "No Operativo"
                      ? "selected"
                      : ""
                  }>No Operativo</option>
                </select>
                <p class="mt-2 text-xs text-gray-500">
                  Última validación:
                  <span id="gps-validacion-timestamp-${index}" class="font-semibold">
                    ${
                      despacho.gpsValidacionTimestamp
                        ? formatDateTime(despacho.gpsValidacionTimestamp)
                        : "Sin registro"
                    }
                  </span>
                </p>
              </div>
            </div>

            <!-- BLOQUE DE TIEMPOS (REAL) -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- SALIDA INICIAL DE LA UNIDAD -->
              <div>
                <label class="block text-sm font-medium text-gray-700">
                  Salida inicial de la Unidad (Real)
                </label>
                <input name="realSalidaUnidad" type="datetime-local"
                  value="${formatForInput(despacho.realSalidaUnidad)}"
                  class="mt-1 w-full p-2 border rounded-md"
                  ${readOnlyAttr} />

                <div class="mt-2 p-2 bg-gray-100 border border-gray-300 rounded-md text-sm text-gray-700">
                  <strong>Programada:</strong> ${formatDateTime(
                    despacho.citaSalidaUnidad
                  )}
                </div>
              </div>

              <!-- CITA DE CARGA (REAL) -->
              <div>
                <label class="block text-sm font-medium text-gray-700">
                  Cita de Carga (Real)
                </label>
                <input name="realCarga" type="datetime-local"
                  value="${formatForInput(despacho.realCarga)}"
                  class="mt-1 w-full p-2 border rounded-md"
                  ${readOnlyAttr} />

                <div class="mt-2 p-2 bg-gray-100 border border-gray-300 rounded-md text-sm text-gray-700">
                  <strong>Programada:</strong> ${formatDateTime(
                    despacho.citaCarga
                  )}
                </div>
              </div>

              <!-- SALIDA DE CARGA (REAL) -->
              <div>
                <label class="block text-sm font-medium text-gray-700">
                  Salida de carga (Real)
                </label>
                <input name="realSalida" type="datetime-local"
                  value="${formatForInput(despacho.realSalida)}"
                  class="mt-1 w-full p-2 border rounded-md"
                  ${readOnlyAttr} />

                <div class="mt-2 p-2 bg-gray-100 border border-gray-300 rounded-md text-sm text-gray-700">
                  <strong>Programada:</strong> ${formatDateTime(
                    despacho.citaSalida
                  )}
                </div>
              </div>

              <!-- PROCESO DE DESCARGA (REAL) -->
              <div>
                <label class="block text-sm font-medium text-gray-700">
                  Proceso de Descarga (Real)
                </label>
                <input name="realDescarga" type="datetime-local"
                  value="${formatForInput(despacho.realDescarga)}"
                  class="mt-1 w-full p-2 border rounded-md"
                  ${readOnlyAttr} />

                <div class="mt-2 p-2 bg-gray-100 border border-gray-300 rounded-md text-sm text-gray-700">
                  <strong>Programada:</strong> ${formatDateTime(
                    despacho.citaDescarga
                  )}
                </div>
              </div>
            </div>

            <!-- CONFIRMACIÓN Y ESTATUS DEL DESPACHO -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium">
                  Confirmación de Entrega Despacho
                </label>
                <select name="confirmacionEntregaSelect" class="mt-1 w-full p-2 border rounded-md" ${disabledAttr}>
                  <option value="">-- Seleccione --</option>
                  <option value="SI" ${
                    despacho.confirmacionEntrega === "SI" ? "selected" : ""
                  }>SI</option>
                  <option value="NO" ${
                    despacho.confirmacionEntrega === "NO" ? "selected" : ""
                  }>NO</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium">
                  Estatus del proceso de Despacho
                </label>
                <select name="estatus" class="mt-1 w-full p-2 border rounded-md" ${disabledAttr}>
                  <option ${
                    despacho.estatus === "Programado" ? "selected" : ""
                  }>Programado</option>
                  <option ${
                    despacho.estatus === "En ruta" ? "selected" : ""
                  }>En ruta</option>
                  <option ${
                    despacho.estatus === "Despacho realizado" ? "selected" : ""
                  }>Despacho realizado</option>
                  <option ${
                    despacho.estatus === "Despacho No realizado"
                      ? "selected"
                      : ""
                  }>Despacho No realizado</option>
                </select>
              </div>
            </div>

            <!-- OBSERVACIONES -->
            <div>
              <label class="block text-sm font-medium">Observaciones</label>
              <textarea name="observaciones" rows="3" class="mt-1 w-full p-2 border rounded-md" ${readOnlyAttr}>${
                despacho.observaciones || ""
              }</textarea>
            </div>

            <!-- INCIDENCIAS + BOTÓN GUARDAR (MODIFICADA) -->
            <div class="mt-4 border-t pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium">Registrar Incidencia</label>
                <div class="flex gap-2 mt-2">
                  <select id="incidencia-tipo" class="p-2 border rounded-md w-full" ${disabledAttr}>${incidenciaOptions}</select>
                  <button type="button" onclick="window.addIncidencia(${index})" class="bg-slate-700 text-white px-4 py-2 rounded-md hover:bg-slate-800 disabled:bg-gray-400" ${disabledAttr}>
                    Agregar
                  </button>
                </div>
                <div id="incidencias-list" class="mt-4 space-y-2">
                  ${renderIncidencias(despacho.incidencias, index, isEditor)}
                </div>
              </div>

              <div>
                <!-- Bloque de nota y botón de protocolo (NUEVO BOTÓN) -->
                <div class="text-sm text-gray-600 mb-2">
                  <strong>Nota:</strong> Las incidencias se guardan automáticamente en localStorage y se incluyen en reportes y KPIs.
                </div>
                <button
                  type="button"
                  onclick="showProtocoloIncidenciaFromSelect()"
                  class="mt-2 inline-flex items-center justify-center bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700"
                >
                  Ver protocolo de la incidencia
                </button>
                <div class="mt-6 text-right">
                  <button type="button" onclick="window.saveSeguimiento(${index})" class="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400" ${disabledAttr}>
                    Guardar Cambios
                  </button>
                </div>
              </div>
            </div>
          </form>
        `;
        container.classList.remove("hidden");
      }

      // --- Cambio de estado GPS (marca fecha/hora) (Mantenida) ---
      function handleGpsValidationChange(index, selectEl) {
        if (userRole !== "editor") return; // Bloquear si no es editor
        if (
          typeof index !== "number" ||
          index < 0 ||
          index >= filteredDespachosData.length
        ) {
          return;
        }

        const d = filteredDespachosData[index];
        const newValue = selectEl.value;

        d.gpsValidacionEstado = newValue || "";
        d.gpsValidacionTimestamp = newValue ? new Date().toISOString() : "";

        saveAllData();

        const span = document.getElementById(
          `gps-validacion-timestamp-${index}`
        );
        if (span) {
          span.textContent = newValue
            ? formatDateTime(d.gpsValidacionTimestamp)
            : "Sin registro";
        }
      }

      // --- renderIncidencias (MODIFICADA para incluir botón de basura) ---
      function renderIncidencias(incidencias, despachoIndex, isEditor) {
        if (!incidencias || incidencias.length === 0)
          return '<p class="text-sm text-gray-500">No hay incidencias.</p>';
        return incidencias
          .map(
            (inc, incIndex) =>
              `<div class="text-sm p-2 rounded-md incidencia-${inc.severidad.toLowerCase()} flex justify-between items-center">
                <div>
                  <strong>${inc.tipo}</strong> - ${formatDateTime(inc.fecha)}
                </div>
                ${
                  isEditor
                    ? `<button type="button" onclick="window.deleteIncidencia(${despachoIndex}, ${incIndex})" class="p-1 text-red-600 hover:text-red-800 transition duration-150" title="Eliminar Incidencia">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M15 6V4c0-1-1-2-2-2h-2c-1 0-2 1-2 2v2"/></svg>
                </button>`
                    : ""
                }
              </div>`
          )
          .join("");
      }

      // Función para eliminar incidencia (NUEVA)
      function deleteIncidencia(despachoIndex, incIndex) {
        if (userRole !== "editor") {
          openCustomAlert(
            "No tienes permisos para eliminar incidencias.",
            "Permiso Denegado"
          );
          return;
        }

        const d = filteredDespachosData[despachoIndex];
        if (d && d.incidencias && d.incidencias.length > incIndex) {
          d.incidencias.splice(incIndex, 1);
          saveAllData();
          openCustomAlert("Incidencia eliminada correctamente.", "Éxito");

          // Refrescar solo la sección de incidencias
          document.getElementById("incidencias-list").innerHTML =
            renderIncidencias(d.incidencias, despachoIndex, true);

          renderRegistroDespacho();
          filterAndRenderKPIs("selectedDate");
          filterAndRenderInforme("selectedDate");
        }
      }

      // --- Protocolos de Incidencia (Mantenido) ---

      const INCIDENCIA_PROTOCOLOS = {
        "Desconexión de batería": {
          nivel: "Crítica",
          pasos: [
            "Verificar si hubo corte de energía/tamper y hora del último ping válido.",
            "Llamar al operador (1 intento inmediato). Si no responde en 5–10 min → tratar como Crítica.",
            "Escalar a Seguridad patrimonial + Jefe de tráfico.",
            "Activar seguimiento alterno (backup/batería interna, último punto, geocercas dinámicas).",
            "Si coincide con desvío/parada/zona de riesgo → proceder como “Robo/Asalto”.",
          ],
        },
        "Botón de pánico": {
          nivel: "Crítica",
          pasos: [
            "Confirmar evento en plataforma (hora, ubicación, velocidad, rumbo).",
            "Escalar de inmediato a Seguridad + Operaciones (sin esperar confirmación).",
            "Intentar contacto breve con el operador (pregunta cerrada y validación con palabra clave interna si existe).",
            "Mantener rastreo en vivo y registrar cambios de ruta/paradas.",
            "Activar protocolo externo según política (p. ej., 911) y notificar aseguradora/cliente si corresponde.",
          ],
        },
        Persecución: {
          nivel: "Crítica",
          pasos: [
            "Escalar inmediato a Seguridad + Operaciones.",
            "Mantener rastreo en vivo; guardar evidencias (ruta, timestamps, eventos).",
            "Indicar al operador ir a punto seguro sin detenerse (según entrenamiento y normas).",
            "Activar autoridades/911 según política y ubicación.",
            "Comunicación controlada y bitácora detallada.",
          ],
        },
        "Accidente vehicular propio": {
          nivel: "Crítica",
          pasos: [
            "Confirmar estado del operador y ocupantes (lesiones / necesidad de emergencia).",
            "Si hay lesionados: activar emergencias (911) según política.",
            "Escalar a Operaciones + Seguridad (y aseguradora).",
            "Coordinar señalización, grúa/taller, transbordo si aplica, aviso al cliente.",
            "Cierre con reporte y evidencias (fotos/ubicación/parte, si procede).",
          ],
        },
        "Robo o asalto": {
          nivel: "Crítica",
          pasos: [
            "Escalar inmediato a Seguridad + Operaciones (y aseguradora).",
            "Intentar contacto solo si es seguro y conforme a tu política (sin exponer al operador).",
            "Mantener seguimiento en vivo y preservar evidencias.",
            "Activar autoridades/911 según política y ubicación.",
            "Gestionar comunicaciones con cliente y continuidad (plan alterno).",
          ],
        },

        "Ausencia de actualización": {
          nivel: "Relevante",
          pasos: [
            "Confirmar último ping y calidad de señal.",
            "Contacto con operador y/o proveedor GPS si hay falla masiva.",
            "Escalar según umbrales y contexto (zona/horario/carga).",
          ],
        },
        "Parada no autorizada": {
          nivel: "Relevante",
          pasos: [
            "Validar duración y lugar (geocerca, gasolinera autorizada, etc.).",
            "Contactar: motivo + tiempo estimado + confirmación de integridad (unidad/carga).",
            "Si no hay contacto o se prolonga: escalar a Tráfico; si hay riesgo → Seguridad.",
            "Registrar y ajustar ETA.",
          ],
        },
        "Operador no contesta más de 2 veces": {
          nivel: "Relevante",
          pasos: [
            "2 intentos en 5–7 min por canales distintos.",
            "Revisar simultáneamente: desvío, paradas, ausencia de actualización, geocercas.",
            "Escalar a Tráfico; si hay condiciones de riesgo → Seguridad (crítica).",
          ],
        },
        "Detención por faltas al reglamento de tránsito": {
          nivel: "Relevante",
          pasos: [
            "Confirmar ubicación y estatus (¿detenido formalmente? ¿solo infracción?).",
            "Escalar a Tráfico/Legal interno (según tu estructura).",
            "Ajustar ETA y notificar cliente si afecta ventana.",
            "Registrar evidencia y número de infracción/autoridad (si aplica).",
          ],
        },
        "Falla mecánica": {
          nivel: "Relevante",
          pasos: [
            "Indicar al operador ubicarse en un punto seguro (si puede) y activar intermitentes.",
            "Coordinar con Taller/Asistencia vial y plan de continuidad (grúa/transbordo).",
            "Actualizar ETA y notificar afectaciones.",
            "Si zona de riesgo: involucrar Seguridad.",
          ],
        },
        "Ponchadura de llantas": {
          nivel: "Relevante",
          pasos: [
            "Confirmar ubicación segura para detenerse y condiciones.",
            "Activar asistencia (refacción/grúa) y evaluar transbordo si impacta.",
            "Registrar tiempo fuera de operación y actualizar ETA.",
          ],
        },
        "Cierres carreteros": {
          nivel: "Relevante",
          pasos: [
            "Confirmar tramo afectado y ruta alterna autorizada.",
            "Aprobar desvío formal (para que no se convierta en “desvío no justificado”).",
            "Ajustar ETA, notificar cliente y registrar causa externa.",
          ],
        },
        "Condiciones climatológicas": {
          nivel: "Relevante",
          pasos: [
            "Evaluar riesgo: reducir velocidad/pausar operación según política.",
            "Ajustar ruta/ETA y notificar al cliente.",
            "Si se decide paro preventivo: definir punto seguro y ventana de reanudación.",
            "Registrar evento para análisis (temporadas/rutas).",
          ],
        },
        "Sin contacto con el operador": {
          nivel: "Relevante",
          pasos: [
            "Hacer 2 intentos de contacto en 5–7 min (llamada + mensaje).",
            "Verificar si hay cobertura baja/“zonas ciegas” (ausencia de actualización).",
            "Escalar a Coordinador/Tráfico si no hay respuesta; si además hay condición sospechosa → Crítica (Seguridad).",
            "Definir acción: punto seguro, retorno a ruta, o verificación física (según tu operación).",
          ],
        },
        "Desvío de ruta": {
          nivel: "Relevante",
          pasos: [
            "Medir magnitud: distancia/tiempo fuera de ruta y dirección (¿se aleja del destino?).",
            "Contactar operador: motivo, ruta alterna y ETA nueva.",
            "Si no hay justificación o no responde: escalar a Tráfico; si empeora (zona riesgo) → Seguridad.",
            "Actualizar ETA y notificar a cliente/almacén si impacta entrega.",
          ],
        },
        "Vehículo sospechoso": {
          nivel: "Relevante",
          pasos: [
            "Contactar al operador y pedir descripción breve (sin distraer) y confirmar si hay “seguimiento” real.",
            "Indicar mantenerse en vías principales y dirigirse a punto seguro (base/caseta/retén autorizado/zona iluminada).",
            "Escalar a Seguridad para acompañamiento remoto y definición de apoyo.",
            "Monitorear patrones: velocidad, paradas, cambios bruscos.",
          ],
        },

        "Salida a destiempo": {
          nivel: "Ordinaria",
          pasos: [
            "Recalcular ETA, reasignar prioridad y notificar al cliente/almacén.",
            "Identificar causa (carga, documentación, disponibilidad) y corregir.",
            "Registrar para mejora (KPI puntualidad de salida).",
          ],
        },
        "Desconocimiento de lugar de entrega": {
          nivel: "Ordinaria",
          pasos: [
            "Proveer indicaciones: contacto del cliente, pin GPS, referencias, restricciones de acceso.",
            "Si el cliente no responde: escalar a atención/dispatch y definir punto de espera seguro.",
            "Documentar para actualizar instrucciones de entrega.",
          ],
        },
        "Mala actitud del Operador": {
          nivel: "Ordinaria",
          pasos: [
            "Interacción breve y profesional: recordar procedimiento y objetivo (seguridad/servicio).",
            "Registrar incidente y evidencias (audio/mensajes si aplica).",
            "Escalar a Supervisor/Operaciones para seguimiento (capacitaciones/medidas).",
            "Si hay negativa a cumplir instrucciones críticas → elevar a Relevante/Crítica según riesgo.",
          ],
        },
      };

      function showProtocoloIncidenciaFromSelect() {
        const sel = document.getElementById("incidencia-tipo");
        const tipo = sel ? sel.value : "";
        if (!tipo) {
          openCustomAlert(
            "Seleccione un tipo de incidencia para ver el protocolo.",
            "Atención"
          );
          return;
        }
        showProtocoloPorTipo(tipo);
      }

      function showProtocoloPorTipo(tipo) {
        const item = INCIDENCIA_PROTOCOLOS[tipo];

        const titleEl = document.getElementById("protocolo-modal-title");
        const bodyEl = document.getElementById("protocolo-modal-body");
        if (!titleEl || !bodyEl) return;

        titleEl.textContent = `Protocolo: ${tipo}`;

        if (!item) {
          bodyEl.innerHTML = `<p class="text-gray-600">No hay protocolo configurado para esta incidencia.</p>`;
          openModal("protocolo-modal");
          return;
        }

        const badgeClass =
          item.nivel === "Crítica"
            ? "bg-red-100 text-red-800"
            : item.nivel === "Relevante"
              ? "bg-orange-100 text-orange-800"
              : "bg-green-100 text-green-800";

        bodyEl.innerHTML = `
          <div class="mb-4">
            <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${badgeClass}">
              ${item.nivel}
            </span>
          </div>
          <ol class="list-decimal ml-5 space-y-2 text-gray-700">
            ${(item.pasos || []).map((p) => `<li>${p}</li>`).join("")}
          </ol>
        `;

        openModal("protocolo-modal");
      }

      // --- Agregar incidencia (Mantenida) ---
      function addIncidencia(index) {
        if (userRole !== "editor") {
          openCustomAlert(
            "No tienes permisos para registrar incidencias.",
            "Permiso Denegado"
          );
          return;
        }

        const sel = document.getElementById("incidencia-tipo");
        if (!sel) return;
        const tipo = sel.value;
        if (!tipo) {
          openCustomAlert("Seleccione un tipo de incidencia.", "Atención");
          return;
        }

        // MODIFICACIÓN: Nuevo severidadMap
        const severidadMap = {
          // 🔴 ROJO (Críticas)
          "Desconexión de batería": "Rojo",
          "Botón de pánico": "Rojo",
          Persecución: "Rojo",
          "Accidente vehicular propio": "Rojo",
          "Robo o asalto": "Rojo",

          // 🟠 NARANJA (Relevantes)
          "Ausencia de actualización": "Naranja",
          "Parada no autorizada": "Naranja",
          "Operador no contesta más de 2 veces": "Naranja",
          "Detención por faltas al reglamento de tránsito": "Naranja",
          "Falla mecánica": "Naranja",
          "Ponchadura de llantas": "Naranja",
          "Cierres carreteros": "Naranja",
          "Condiciones climatológicas": "Naranja",
          "Sin contacto con el operador": "Naranja",
          "Desvío de ruta": "Naranja",
          "Vehículo sospechoso": "Naranja",

          // 🟢 VERDE (Ordinarias)
          "Salida a destiempo": "Verde",
          "Desconocimiento de lugar de entrega": "Verde",
          "Mala actitud del Operador": "Verde",
        };

        if (
          typeof index !== "number" ||
          index < 0 ||
          index >= filteredDespachosData.length
        ) {
          openCustomAlert("Unidad no seleccionada correctamente.", "Error");
          return;
        }

        const tipoSeleccionado = tipo;
        const severidad = severidadMap[tipoSeleccionado] || "Verde";

        filteredDespachosData[index].incidencias.push({
          tipo: tipoSeleccionado,
          fecha: new Date().toISOString(),
          severidad: severidad,
        });

        saveAllData();
        // Redibuja con permisos de edición (true)
        document.getElementById("incidencias-list").innerHTML =
          renderIncidencias(
            filteredDespachosData[index].incidencias,
            index,
            true
          );
        renderRegistroDespacho();
        filterAndRenderKPIs("selectedDate");
        filterAndRenderInforme("selectedDate");
      }

      // --- Guardado del seguimiento (Mantenida) ---
      function saveSeguimiento(index) {
        if (userRole !== "editor") {
          openCustomAlert(
            "No tienes permisos para guardar cambios de seguimiento.",
            "Permiso Denegado"
          );
          return;
        }

        const form = document.getElementById("form-seguimiento");
        if (!form) return openCustomAlert("Formulario no encontrado.", "Error");
        const d = filteredDespachosData[index];

        d.realCarga = form.elements["realCarga"].value;
        d.realSalida = form.elements["realSalida"].value;
        d.realDescarga = form.elements["realDescarga"].value;
        d.realSalidaUnidad = form.elements["realSalidaUnidad"].value;

        // Nuevo: ID del operador de monitoreo
        if (form.elements["operadorMonitoreoId"]) {
          d.operadorMonitoreoId =
            form.elements["operadorMonitoreoId"].value || "";
        }

        // Asegurar estado de validación GPS
        const prevGpsEstado = d.gpsValidacionEstado || "";
        const newGpsEstado = form.elements["gpsValidacionEstado"]
          ? form.elements["gpsValidacionEstado"].value || ""
          : prevGpsEstado;

        if (newGpsEstado !== prevGpsEstado) {
          d.gpsValidacionEstado = newGpsEstado;
          d.gpsValidacionTimestamp = newGpsEstado
            ? new Date().toISOString()
            : "";
        }

        const nuevaConfirmacion =
          form.elements["confirmacionEntregaSelect"].value;
        if (nuevaConfirmacion && d.confirmacionEntrega !== nuevaConfirmacion)
          d.realConfirmacionEntrega = new Date().toISOString();
        else if (!nuevaConfirmacion && d.confirmacionEntrega)
          d.realConfirmacionEntrega = "";

        d.confirmacionEntrega = nuevaConfirmacion || null;

        const newObservaciones = form.elements["observaciones"].value;
        if (newObservaciones && d.observaciones !== newObservaciones)
          d.observacionesTimestamp = new Date().toISOString();
        else if (!newObservaciones) d.observacionesTimestamp = "";
        d.observaciones = newObservaciones;

        const estatusSelect = form.elements["estatus"];
        if (d.confirmacionEntrega === "SI") d.estatus = "Despacho realizado";
        else if (d.confirmacionEntrega === "NO")
          d.estatus = "Despacho No realizado";
        else if (
          d.realSalidaUnidad ||
          d.realCarga ||
          d.realSalida ||
          d.realDescarga
        )
          d.estatus = "En ruta";
        else d.estatus = estatusSelect.value;

        saveAllData();
        // Usar mensaje en lugar de alert
        document.getElementById("seguimiento-form-container").innerHTML +=
          `<div id="save-msg" class="mt-4 p-3 bg-green-100 text-green-700 rounded-lg">Datos guardados localmente para la unidad ${d.unidad}.</div>`;
        setTimeout(() => document.getElementById("save-msg")?.remove(), 3000);

        renderAllTabs();
        document.getElementById("unidad-selector").value = index;
        renderSeguimientoForm(index);
      }

      // --- Pestaña 4: Matriz / Registro (Mantenida) ---
      function populateRegistroFilter() {
        const selector = document.getElementById("registro-unidad-filter");
        selector.innerHTML = '<option value="all">Mostrar Todas</option>';
        filteredDespachosData.forEach((d, i) => {
          selector.innerHTML += `<option value="${i}">${d.unidad}</option>`;
        });
      }

      function renderRegistroDespacho() {
        const container = document.getElementById("registro-board-container");
        const filter = document.getElementById("registro-unidad-filter");
        container.innerHTML = "";
        let dataToRender = filteredDespachosData;
        if (filter && filter.value !== "all") {
          dataToRender = [filteredDespachosData[filter.value]];
        }
        if (!dataToRender || dataToRender.length === 0 || !dataToRender[0]) {
          container.innerHTML = `<div class="text-center p-6">No hay despachos para mostrar.</div>`;
          return;
        }
        const board = document.createElement("div");
        board.className = "registro-board";
        // Header row (títulos igual que pestaña 3)
        const headerRow = document.createElement("div");
        headerRow.className = "board-row font-bold text-gray-600";
        [
          "Unidad",
          "Salida inicial de la Unidad",
          "Proceso de Carga",
          "Salida de carga",
          "Proceso de Descarga",
          "Estatus del proceso de Despacho",
        ].forEach((h, i) => {
          const cell = document.createElement("div");
          cell.className = "board-cell";
          cell.textContent = h;
          cell.setAttribute("data-label", h);
          headerRow.appendChild(cell);
        });
        board.appendChild(headerRow);
        // Rows
        dataToRender.forEach((d) => {
          const row = document.createElement("div");
          row.className = "board-row";

          const gpsOk = String(d.gpsValidacionEstado||"").trim().toLowerCase() === "operativo";
          const dotClass = gpsOk ? "bg-green-500" : "bg-red-500";
          // Unidad cell
          const uc = document.createElement("div");
          uc.className = "board-cell unit-cell";
          uc.innerHTML = `
            <div class="flex items-center justify-center gap-2">
              <span class="inline-block w-3 h-3 rounded-full ${dotClass}" title="GPS: ${escapeHtml(d.gpsValidacionEstado||"Sin registro")}"></span>
              <strong>${escapeHtml(d.unidad)}</strong>
            </div>
            <p class="text-xs">${escapeHtml(d.placas)}</p>
            <p class="text-xs italic">
              ${d.operadorMonitoreoId ? "Operador: " + escapeHtml(d.operadorMonitoreoId) : ""}
            </p>
            <p class="text-xs italic">GPS: ${escapeHtml(d.gpsValidacionEstado || "Sin registro")}</p>
          `;
          uc.setAttribute("data-label", "Unidad");
          row.appendChild(uc);
          // tasks: salida unidad, carga, salida, descarga
          const tasks = [
            {
              label: "Salida inicial de la Unidad",
              cita: d.citaSalidaUnidad,
              real: d.realSalidaUnidad,
            },
            { label: "Proceso de Carga", cita: d.citaCarga, real: d.realCarga },
            {
              label: "Salida de carga",
              cita: d.citaSalida,
              real: d.realSalida,
            },
            {
              label: "Proceso de Descarga",
              cita: d.citaDescarga,
              real: d.realDescarga,
            },
          ];
          tasks.forEach((task) => {
            const taskCell = document.createElement("div");
            const bgColorClass = task.real
              ? checkTimeDeviation(task.cita, task.real) === "estatus-rojo"
                ? "estatus-rojo"
                : "estatus-verde"
              : "task-cell";
            taskCell.className = `board-cell ${bgColorClass}`;
            taskCell.innerHTML = `<p class="text-xs">Prog: ${formatDateTime(
              task.cita
            )}</p><p class="font-semibold">Real: ${
              task.real ? formatDateTime(task.real) : "-"
            }</p>`;
            taskCell.setAttribute("data-label", task.label);
            row.appendChild(taskCell);
          });
          // Estatus del proceso de Despacho con colores
          const statusCell = document.createElement("div");
          let statusClass = "task-cell";
          if (d.estatus === "En ruta") statusClass = "estatus-en-ruta";
          else if (d.estatus === "Despacho realizado")
            statusClass = "estatus-verde";
          else if (d.estatus === "Despacho No realizado")
            statusClass = "estatus-rojo";
          // Programado se queda gris (task-cell)
          statusCell.className = `board-cell ${statusClass}`;
          statusCell.textContent = d.estatus || "Sin estatus";
          statusCell.setAttribute(
            "data-label",
            "Estatus del proceso de Despacho"
          );
          row.appendChild(statusCell);
          board.appendChild(row);
        });
        container.appendChild(board);
      }

      // --- Charts: cumplimiento e incidencias (Mantenida) ---
      const centerTextPlugin = {
        id: "centerText",
        beforeDraw: (chart) => {
          if (chart.config.type !== "doughnut") return;
          const {
            ctx,
            chartArea: { top, width, height },
          } = chart;
          const total = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
          if (total === 0) return;
          ctx.save();
          ctx.font = "bold 24px Inter";
          ctx.fillStyle = "#374151";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(total, width / 2, top + height / 2);
          ctx.font = "normal 12px Inter";
          ctx.fillStyle = "#6b7280";
          ctx.fillText("TOTAL", width / 2, top + height / 2 + 20);
          ctx.restore();
        },
      };

      function updateCumplimientoChart(
        despachosATiempo,
        despachosConRetraso,
        despachosEnRuta,
        despachosProgramados
      ) {
        const ctx = document
          .getElementById("kpi-cumplimiento-chart")
          .getContext("2d");
        if (charts.cumplimiento) charts.cumplimiento.destroy();
        charts.cumplimiento = new Chart(ctx, {
          type: "bar",
          data: {
            labels: ["A Tiempo", "Con Retraso", "En Ruta", "Programados"],
            datasets: [
              {
                data: [
                  despachosATiempo.length,
                  despachosConRetraso.length,
                  despachosEnRuta.length,
                  despachosProgramados.length,
                ],
                backgroundColor: ["#22c55e", "#ef4444", "#f59e0b", "#6b7280"],
                borderRadius: 4,
                barThickness: 30,
              },
            ],
          },
          options: {
            indexAxis: "y",
            responsive: true,
            scales: {
              x: {
                grid: { borderColor: "#e5e7eb", color: "#f3f4f6" },
                ticks: { font: { size: 12 } },
              },
              y: {
                grid: { display: false },
                ticks: { font: { size: 12 } },
              },
            },
            plugins: {
              legend: { display: false },
              datalabels: {
                anchor: "end",
                align: "right",
                offset: 8,
                color: "#1f2937",
                font: { size: 14, weight: "600" },
              },
            },
          },
        });
      }

      function updateIncidenciasChart(data) {
        const ctx = document.getElementById("kpi-incidencias-chart");
        if (!ctx) return;
        if (charts.incidencias) charts.incidencias.destroy();
        const labels = Object.keys(data);
        const values = Object.values(data);
        if (labels.length === 0) {
          charts.incidencias = new Chart(ctx, {
            type: "doughnut",
            data: {
              labels: ["Sin incidencias"],
              datasets: [{ data: [1], backgroundColor: ["#e5e7eb"] }],
            },
            options: {
              responsive: true,
              plugins: { legend: { display: false } },
            },
          });
          return;
        }
        charts.incidencias = new Chart(ctx, {
          type: "doughnut",
          data: {
            labels: labels,
            datasets: [
              {
                data: values,
                backgroundColor: [
                  "#ef4444",
                  "#f97316",
                  "#22c55e",
                  "#3b82f6",
                  "#6366f1",
                  "#8b5cf6",
                  "#f472b6",
                  "#10b981",
                ],
                borderColor: "#fff",
                borderWidth: 4,
                hoverOffset: 8,
              },
            ],
          },
          options: {
            responsive: true,
            cutout: "70%",
            plugins: {
              legend: {
                position: "bottom",
                labels: { usePointStyle: true, pointStyle: "circle" },
              },
              tooltip: {
                callbacks: {
                  label: (context) => ` ${context.label}: ${context.raw}`,
                },
              },
            },
          },
          plugins: [centerTextPlugin],
        });
      }

      function updateKPIs(data) {
        const total = data.length;
        const despachosRealizados = data.filter(
          (d) => d.estatus === "Despacho realizado"
        );
        const despachosATiempo = despachosRealizados.filter(
          (d) => d.confirmacionEntrega === "SI"
        );
        const despachosConRetraso =
          despachosRealizados.length - despachosATiempo.length;
        const despachosEnRuta = data.filter((d) => d.estatus === "En ruta");
        const despachosProgramados = data.filter(
          (d) => d.estatus === "Programado"
        );

        kpiVehicleData = {
          aTiempo: despachosATiempo.map((d) => d.unidad),
          conRetraso: despachosRealizados
            .filter((d) => !(d.confirmacionEntrega === "SI"))
            .map((d) => d.unidad),
          enRuta: despachosEnRuta.map((d) => d.unidad),
          programados: despachosProgramados.map((d) => d.unidad),
        };

        document.getElementById("kpi-total-despachos").textContent = total;
        document.getElementById("kpi-despachos-a-tiempo").textContent =
          despachosATiempo.length;
        document.getElementById("kpi-despachos-retraso").textContent =
          despachosConRetraso;
        document.getElementById("kpi-despachos-en-ruta").textContent =
          despachosEnRuta.length;
        document.getElementById("kpi-despachos-programados").textContent =
          despachosProgramados.length;

        updateCumplimientoChart(
          despachosATiempo,
          despachosRealizados.filter((d) => !(d.confirmacionEntrega === "SI")),
          despachosEnRuta,
          despachosProgramados
        );

        const incidenciasCount = {};
        data.forEach((d) =>
          d.incidencias.forEach((inc) => {
            incidenciasCount[inc.tipo] = (incidenciasCount[inc.tipo] || 0) + 1;
          })
        );
        updateIncidenciasChart(incidenciasCount);
      }

      // --- KPIs: filtro por rango (Mantenida) ---
      function filterAndRenderKPIs(range, event) {
        const today = dayjs();
        let dataForRange;
        const selected = dayjs(document.getElementById("date-filter").value);
        if (range === "selectedDate")
          dataForRange = allDespachosData.filter((d) =>
            dayjs(d.fechaProgramada).isSame(selected, "day")
          );
        else if (range === "today")
          dataForRange = allDespachosData.filter((d) =>
            dayjs(d.fechaProgramada).isSame(today, "day")
          );
        else if (range === "week")
          dataForRange = allDespachosData.filter((d) =>
            dayjs(d.fechaProgramada).isAfter(today.subtract(7, "day"))
          );
        else if (range === "month")
          dataForRange = allDespachosData.filter((d) =>
            dayjs(d.fechaProgramada).isAfter(today.subtract(30, "day"))
          );

        updateKPIs(dataForRange || allDespachosData);

        document
          .querySelectorAll("#kpi-filter-buttons .kpi-filter-btn")
          .forEach((btn) => btn.classList.remove("kpi-filter-btn-active"));
        if (event) event.target.classList.add("kpi-filter-btn-active");
        else
          document
            .querySelector("#kpi-filter-buttons .kpi-filter-btn")
            ?.classList.add("kpi-filter-btn-active");
      }

      // --- Informe Ejecutivo (pestaña 6) (MODIFICADA) ---
      function filterAndRenderInforme(range, event) {
        let dataForRange;
        const today = dayjs();
        const selected = dayjs(document.getElementById("date-filter").value);
        if (range === "selectedDate")
          dataForRange = allDespachosData.filter((d) =>
            dayjs(d.fechaProgramada).isSame(selected, "day")
          );
        else if (range === "today")
          dataForRange = allDespachosData.filter((d) =>
            dayjs(d.fechaProgramada).isSame(today, "day")
          );
        else if (range === "week")
          dataForRange = allDespachosData.filter((d) =>
            dayjs(d.fechaProgramada).isAfter(today.subtract(7, "day"))
          );
        else if (range === "month")
          dataForRange = allDespachosData.filter((d) =>
            dayjs(d.fechaProgramada).isAfter(today.subtract(30, "day"))
          );
        renderInforme(dataForRange || allDespachosData);
      }

      function renderInforme(data) {
        const container = document.getElementById("informe-container");
        const btnWord = document.getElementById("download-report-btn");
        const btnExcel = document.getElementById("download-excel-report-btn");

        if (!data || data.length === 0) {
          container.innerHTML = `<p class="text-center p-6 bg-gray-100 rounded-lg">No hay datos para generar un informe.</p>`;
          if (btnWord) btnWord.disabled = true;
          if (btnExcel) btnExcel.disabled = true;
          lastInformeData = [];
          return;
        }

        lastInformeData = data.slice();
        if (btnWord) btnWord.disabled = false;
        if (btnExcel) btnExcel.disabled = false;

        const total = data.length;
        const realizados = data.filter(
          (d) => d.estatus === "Despacho realizado"
        );
        const aTiempo = realizados.filter(
          (d) =>
            d.realDescarga &&
            checkTimeDeviation(d.citaDescarga, d.realDescarga) ===
              "estatus-verde"
        ).length;
        const conRetraso = realizados.length - aTiempo;
        const totalIncidencias = data.reduce(
          (acc, d) => acc + d.incidencias.length,
          0
        );

        let html = `<div id="report-content-for-download">
          <h2 class="text-xl font-bold mb-4">Informe de Despachos</h2>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-gray-100 p-4 rounded-lg text-center">
              <p class="text-sm font-medium">Total</p>
              <p class="text-2xl font-bold">${total}</p>
            </div>
            <div class="bg-green-100 p-4 rounded-lg text-center">
              <p class="text-sm font-medium">A Tiempo</p>
              <p class="text-2xl font-bold">${aTiempo}</p>
            </div>
            <div class="bg-red-100 p-4 rounded-lg text-center">
              <p class="text-sm font-medium">Retraso</p>
              <p class="text-2xl font-bold">${conRetraso}</p>
            </div>
            <div class="bg-orange-100 p-4 rounded-lg text-center">
              <p class="text-sm font-medium">Incidencias</p>
              <p class="text-2xl font-bold">${totalIncidencias}</p>
            </div>
          </div>

          <h3 class="text-lg font-semibold mb-4">Detalle de Viajes</h3>
          <table class="min-w-full divide-y divide-gray-200 text-sm mb-8">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-2 text-left">Unidad</th>
                <th class="px-4 py-2 text-left">Ruta</th>
                <th class="px-4 py-2 text-left">Estatus</th>
                <th class="px-4 py-2 text-left">Prog. Descarga</th>
                <th class="px-4 py-2 text-left">Real Descarga</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y">`;
        data.forEach((d) => {
          const statusClass = d.realDescarga
            ? checkTimeDeviation(d.citaDescarga, d.realDescarga)
            : "task-cell";
          html += `<tr>
            <td class="px-4 py-2 font-semibold">${d.unidad}</td>
            <td class="px-4 py-2">${d.ruta}</td>
            <td class="px-4 py-2">${d.estatus}</td>
            <td class="px-4 py-2">${formatDateTime(d.citaDescarga)}</td>
            <td class="px-4 py-2 font-semibold ${statusClass}">${formatDateTime(
              d.realDescarga
            )}</td>
          </tr>`;
        });

        html += `</tbody></table>`;
        // Incidencias con color (como pestaña 3)
        let incidenciasRows = "";
        data.forEach((d) => {
          if (d.incidencias && d.incidencias.length > 0) {
            d.incidencias.forEach((inc) => {
              const sevClass =
                inc.severidad === "Rojo"
                  ? "incidencia-rojo"
                  : inc.severidad === "Naranja"
                    ? "incidencia-naranja"
                    : "incidencia-verde";

              incidenciasRows += `<tr class="${sevClass}">
                <td class="px-4 py-2 font-semibold">${d.unidad}</td>
                <td class="px-4 py-2">${d.ruta}</td>
                <td class="px-4 py-2">${inc.tipo}</td>
                <td class="px-4 py-2">${formatDateTime(inc.fecha)}</td>
              </tr>`;
            });
          }
        });

        if (incidenciasRows) {
          html += `
            <h3 class="text-lg font-semibold mb-4">Incidencias registradas por vehículo</h3>
            <table class="min-w-full divide-y divide-gray-200 text-sm">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-2 text-left">Unidad</th>
                  <th class="px-4 py-2 text-left">Ruta</th>
                  <th class="px-4 py-2 text-left">Tipo de Incidencia</th>
                  <th class="px-4 py-2 text-left">Fecha de Registro</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y">
                ${incidenciasRows}
              </tbody>
            </table>
          `;
        } else {
          html += `<p class="mt-4 text-sm text-gray-500">No se registraron incidencias en este periodo.</p>`;
        }

        html += `</div>`;
        container.innerHTML = html;
      }

      // --- Exportación principal XLSX (Mantenida) ---
      function exportUpdatedSheet() {
        if (allDespachosData.length === 0) {
          // Reemplazo de alert()
          openCustomAlert("No hay datos para exportar.", "Atención");
          return;
        }
        const dataToExport = allDespachosData.map((d) => ({
          Fecha: d.fechaProgramada
            ? dayjs(d.fechaProgramada).format("DD/MM/YYYY")
            : "",
          Folio: d.folio,
          Unidad: d.unidad,
          Placas: d.placas,
          Operador: d.operador,
          Móvil: d.telefono,
          Ruta: d.ruta,
          Origen: d.origen,
          Destino: d.destino,
          "Salida de la unidad": formatDateTime(d.citaSalidaUnidad),
          "Real Salida de la unidad": formatDateTime(d.realSalidaUnidad),
          "Cita de Carga": formatDateTime(d.citaCarga),
          "Real Cita de Carga": formatDateTime(d.realCarga),
          "Salida de Carga": formatDateTime(d.citaSalida),
          "Real Salida de Carga": formatDateTime(d.realSalida),
          "Cita de Descarga": formatDateTime(d.citaDescarga),
          "Real Cita de Descarga": formatDateTime(d.realDescarga),
          "Confirmacion de Entrega de Carga": d.confirmacionEntrega,
          Estatus: d.estatus,
          Incidencias: d.incidencias
            .map((i) => `${i.tipo} (${formatDateTime(i.fecha)})`)
            .join("; "),
          Observaciones: d.observaciones,
          "ID Operador Monitoreo": d.operadorMonitoreoId || "",
          "Estado GPS/Accesorios": d.gpsValidacionEstado || "",
          "Fecha Validación GPS": d.gpsValidacionTimestamp
            ? formatDateTime(d.gpsValidacionTimestamp)
            : "",
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(
          workbook,
          worksheet,
          "Bitacora Actualizada"
        );
        XLSX.writeFile(
          workbook,
          `Bitacora_Actualizada_${dayjs().format("YYYY-MM-DD")}.xlsx`
        );
      }

      // --- Navegación de pestañas y modal (MODIFICADA para control de rol) ---
      function changeTab(index) {
        // Validación de rol antes de cambiar de pestaña
        if (userRole) {
          const allowedTabs = USER_ROLES[userRole].tabs;
          if (!allowedTabs.includes(index)) {
            openCustomAlert(
              "No tienes permiso para acceder a esta pestaña.",
              "Permiso Denegado"
            );
            return;
          }
        } else {
          // Si no hay rol, forzar login
          document.getElementById("login-modal").classList.remove("hidden");
          return;
        }

        document.querySelectorAll(".tab-btn").forEach((tab, i) => {
          const content = document.getElementById(`tab-${i}`);
          // Solo activar la pestaña si está visible
          if (!tab.classList.contains("hidden")) {
            tab.classList.toggle("tab-active", i === index);
            tab.classList.toggle("text-gray-500", i !== index);
          }
          if (content) content.classList.toggle("hidden", i !== index);
        });

        if (index === 4) filterAndRenderKPIs("selectedDate");
        if (index === 5) filterAndRenderInforme("selectedDate");
        if (index === 6) {
          // Cargar desde MySQL vía PHP
          cargarInformesGuardados();
        }
      }

      function openModal(modalId) {
        document.getElementById(modalId).classList.remove("hidden");

        // Cargar datos de emergencia al abrir el modal 911 por primera vez
        if (modalId === "emergency911-modal" && !emergency911Cache.loaded) {
          loadEmergency911Data();
        }
      }
      function closeModal(modalId) {
        document.getElementById(modalId).classList.add("hidden");
      }
      window.onclick = function (event) {
        if (event.target.classList.contains("modal"))
          event.target.classList.add("hidden");
      };

      function showUnitData() {
        const selector = document.getElementById("unidad-selector");
        const index = selector.value;
        if (index === "") return;
        const d = filteredDespachosData[index];
        document.getElementById("modal-body").innerHTML =
          `<div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <p><strong>Folio:</strong></p><p>${String(d.folio).padStart(
            3,
            "0"
          )}</p>
          <p><strong>Unidad:</strong></p><p>${d.unidad}</p>
          <p><strong>Placas:</strong></p><p>${d.placas}</p>
          <p><strong>Operador:</strong></p><p>${d.operador}</p>
          <p><strong>Teléfono:</strong></p><p>${d.telefono}</p>
          <p><strong>Ruta:</strong></p><p>${d.ruta}</p>
          <p><strong>Origen:</strong></p><p>${d.origen}</p>
          <p><strong>Destino:</strong></p><p>${d.destino}</p>
        </div>`;
        openModal("data-modal");
      }

      // --- Descargar informe DOC (Mantenida) ---
      function downloadWordReport() {
        const container = document.getElementById(
          "report-content-for-download"
        );
        if (!container) {
          openCustomAlert(
            "No hay contenido de informe para descargar.",
            "Atención"
          );
          return;
        }

        const contenido = `
          <html>
            <head>
              <meta charset="UTF-8">
              <title>Informe de Despachos</title>
            </head>
            <body>
              ${container.innerHTML}
            </body>
          </html>
        `;

        const blob = new Blob(["\ufeff", contenido], {
          type: "application/msword",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `Informe_Despachos_${dayjs().format("YYYY-MM-DD")}.doc`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      // --- Descargar informe detallado XLSX (Mantenida) ---
      function downloadReportAsExcel() {
        if (!lastInformeData || lastInformeData.length === 0) {
          openCustomAlert("No hay datos de informe para exportar.", "Atención");
          return;
        }

        const rows = [];

        lastInformeData.forEach((d) => {
          // Fila principal del viaje
          rows.push({
            Fecha: d.fechaProgramada
              ? dayjs(d.fechaProgramada).format("DD/MM/YYYY")
              : "",
            Folio: d.folio,
            Unidad: d.unidad,
            Placas: d.placas,
            Operador: d.operador,
            Ruta: d.ruta,
            Origen: d.origen,
            Destino: d.destino,
            Estatus: d.estatus,
            "Prog. Descarga": formatDateTime(d.citaDescarga),
            "Real Descarga": formatDateTime(d.realDescarga),
            "ID Operador Monitoreo": d.operadorMonitoreoId || "",
            "Estado GPS/Accesorios": d.gpsValidacionEstado || "",
            "Fecha Validación GPS": d.gpsValidacionTimestamp
              ? formatDateTime(d.gpsValidacionTimestamp)
              : "",
            "Total Incidencias": d.incidencias ? d.incidencias.length : 0,
          });

          // Filas adicionales por cada incidencia de ese viaje
          if (d.incidencias && d.incidencias.length > 0) {
            d.incidencias.forEach((inc) => {
              rows.push({
                Fecha: "",
                Folio: d.folio,
                Unidad: d.unidad,
                Placas: d.placas,
                Operador: d.operador,
                Ruta: d.ruta,
                Origen: d.origen,
                Destino: d.destino,
                Estatus: d.estatus,
                "Prog. Descarga": "",
                "Real Descarga": "",
                "ID Operador Monitoreo": "",
                "Estado GPS/Accesorios": "",
                "Fecha Validación GPS": "",
                "Total Incidencias": "",
                "Incidencia Tipo": inc.tipo,
                "Incidencia Severidad": inc.severidad,
                "Incidencia Fecha": formatDateTime(inc.fecha),
              });
            });
          }
        });

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Informe Detallado");
        XLSX.writeFile(
          workbook,
          `Informe_Detallado_${dayjs().format("YYYY-MM-DD")}.xlsx`
        );
      }

      // --- Informes guardados (MySQL vía PHP) ---

      function setInformesFilterSummary(visibleCount, totalCount) {
        const el = document.getElementById("informes-filtro-resumen");
        if (!el) return;
        const v = Number.isFinite(visibleCount) ? visibleCount : 0;
        const t = Number.isFinite(totalCount) ? totalCount : 0;
        el.textContent = `Mostrando ${v} de ${t}`;
      }

      function getNormalizedString(value) {
        return (value ?? "").toString().toLowerCase().trim();
      }

      function parseInformeDate(value) {
        const raw = (value ?? "").toString().trim();
        if (!raw) return null;
        const d = dayjs(raw, ["YYYY-MM-DD", "DD/MM/YYYY", "DD-MM-YYYY"], true);
        if (d.isValid()) return d.startOf("day");
        const iso = dayjs(raw);
        return iso.isValid() ? iso.startOf("day") : null;
      }

      function populateOperadorInformeFilter(informes) {
        const sel = document.getElementById("informes-filtro-operador");
        if (!sel) return;

        const current = sel.value || "";
        const unique = new Set();
        (informes || []).forEach((inf) => {
          const op = (inf?.operador_monitoreo ?? "").toString().trim();
          if (op) unique.add(op);
        });
        const operators = Array.from(unique).sort((a, b) =>
          a.localeCompare(b, "es", { sensitivity: "base" })
        );

        sel.innerHTML = "";
        const optAll = document.createElement("option");
        optAll.value = "";
        optAll.textContent = "Todos";
        sel.appendChild(optAll);
        operators.forEach((op) => {
          const opt = document.createElement("option");
          opt.value = op;
          opt.textContent = op;
          sel.appendChild(opt);
        });

        sel.value = operators.includes(current) ? current : "";
      }

      function applyInformesFilters() {
        const container = document.getElementById("informes-lista-container");
        if (!container) return;

        const all = Array.isArray(informesGuardadosCache)
          ? informesGuardadosCache
          : [];

        const q = getNormalizedString(
          document.getElementById("informes-filtro-texto")?.value
        );
        const operadorSel = (
          document.getElementById("informes-filtro-operador")?.value ?? ""
        )
          .toString()
          .trim();
        const soloIncidencias = Boolean(
          document.getElementById("informes-filtro-solo-incidencias")
            ?.checked
        );
        const desde = parseInformeDate(
          document.getElementById("informes-filtro-fecha-desde")?.value
        );
        const hasta = parseInformeDate(
          document.getElementById("informes-filtro-fecha-hasta")?.value
        );

        const filtered = all.filter((inf) => {
          if (!inf) return false;

          if (q) {
            const haystack = [
              inf.id,
              inf.titulo,
              inf.operador_monitoreo,
              inf.fecha_despacho,
            ]
              .map(getNormalizedString)
              .join(" ");
            if (!haystack.includes(q)) return false;
          }

          if (operadorSel) {
            const op = (inf.operador_monitoreo ?? "").toString().trim();
            if (op !== operadorSel) return false;
          }

          if (soloIncidencias) {
            const ti = parseInt(inf.total_incidencias, 10) || 0;
            if (ti <= 0) return false;
          }

          if (desde || hasta) {
            const d = parseInformeDate(inf.fecha_despacho);
            if (!d) return false;
            if (desde && d.isBefore(desde)) return false;
            if (hasta && d.isAfter(hasta)) return false;
          }

          return true;
        });

        setInformesFilterSummary(filtered.length, all.length);
        mostrarInformes(filtered, container);
      }

      function resetInformesFilters() {
        const ids = [
          "informes-filtro-texto",
          "informes-filtro-fecha-desde",
          "informes-filtro-fecha-hasta",
        ];
        ids.forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.value = "";
        });
        const op = document.getElementById("informes-filtro-operador");
        if (op) op.value = "";
        const chk = document.getElementById("informes-filtro-solo-incidencias");
        if (chk) chk.checked = false;
        applyInformesFilters();
      }

      /**
       * Muestra una alerta personalizada (reemplazando window.alert/confirm)
       * @param {string} message Mensaje a mostrar.
       * @param {string} title Título de la alerta.
       */
      function openCustomAlert(message, title = "Aviso") {
        const modalId = "custom-alert-modal";
        let modal = document.getElementById(modalId);

        if (!modal) {
          modal = document.createElement("div");
          modal.id = modalId;
          modal.className =
            "modal hidden fixed inset-0 flex items-center justify-center z-50 p-4";
          modal.innerHTML = `
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
              <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-bold text-gray-800" id="alert-title">${title}</h3>
                <button onclick="closeModal('${modalId}')" class="text-gray-400 hover:text-gray-600">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              <div id="alert-message" class="text-gray-600 text-sm mb-4">${message}</div>
              <div class="text-right">
                <button onclick="closeModal('${modalId}')" class="bg-blue-600 text-white px-4 py-2 rounded-lg">Aceptar</button>
              </div>
            </div>
          `;
          document.body.appendChild(modal);
        } else {
          document.getElementById("alert-title").textContent = title;
          document.getElementById("alert-message").textContent = message;
        }

        openModal(modalId);
      }

      /**
       * Guarda el informe en MySQL vía PHP (guardar_informe.php)
       */
      async function guardarInformeEnBD() {
        if (userRole !== "editor") {
          openCustomAlert(
            "No tienes permisos para guardar informes.",
            "Permiso Denegado"
          );
          return;
        }
        if (!lastInformeData || lastInformeData.length === 0) {
          openCustomAlert("No hay datos de informe para guardar.", "Atención");
          return;
        }

        const total = lastInformeData.length;
        const realizados = lastInformeData.filter(
          (d) => d.estatus === "Despacho realizado"
        );
        const aTiempo = realizados.filter(
          (d) =>
            d.realDescarga &&
            checkTimeDeviation(d.citaDescarga, d.realDescarga) ===
              "estatus-verde"
        ).length;
        const conRetraso = realizados.length - aTiempo;
        const enRuta = lastInformeData.filter(
          (d) => d.estatus === "En ruta"
        ).length;
        const programados = lastInformeData.filter(
          (d) => d.estatus === "Programado"
        ).length;
        const totalIncidencias = lastInformeData.reduce(
          (acc, d) => acc + (d.incidencias ? d.incidencias.length : 0),
          0
        );

        const operadorMonitoreo =
          lastInformeData[0]?.operadorMonitoreoId || "Desconocido";
        const fechaDespacho =
          document.getElementById("date-filter")?.value ||
          new Date().toISOString().split("T")[0];

        const titulo = prompt(
          "Ingrese un título para el informe:",
          `Informe de Despachos - ${fechaDespacho} - Operador: ${operadorMonitoreo} - Total: ${total}`
        );

        if (!titulo) return;

        const btnGuardar = document.getElementById("guardar-informe-btn");
        const originalText = btnGuardar?.textContent;
        if (btnGuardar) {
          btnGuardar.textContent = "Guardando...";
          btnGuardar.disabled = true;
        }

        try {
          const payload = {
            titulo,
            fecha_despacho: fechaDespacho,
            total_despachos: total,
            a_tiempo: aTiempo,
            con_retraso: conRetraso,
            en_ruta: enRuta,
            programados,
            total_incidencias: totalIncidencias,
            operador_monitoreo: operadorMonitoreo,
            // Este campo es el que espera guardar_informe.php
            datos_informe: lastInformeData,
          };

          const res = await fetch("guardar_informe.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const text = await res.text();
          let data;
          try {
            data = JSON.parse(text);
          } catch (e) {
            throw new Error(
              `Respuesta inválida del servidor (no JSON). Inicio: ${text.substring(0, 200)}`
            );
          }

          if (!res.ok || !data?.success) {
            throw new Error(data?.message || `Error HTTP ${res.status}`);
          }

          openCustomAlert(
            `✅ Informe guardado correctamente (ID: ${data.id})`,
            "Guardado Exitoso"
          );
        } catch (error) {
          console.error("Error al guardar informe (MySQL):", error);
          openCustomAlert(
            `❌ Error al guardar en BD: ${error.message}`,
            "Error de Guardado"
          );
        } finally {
          if (btnGuardar) {
            btnGuardar.textContent = originalText || "Guardar Informe";
            btnGuardar.disabled = false;
          }
        }
      }

      /**
       * Carga los informes guardados desde MySQL (obtener_informes.php)
       */
      async function cargarInformesGuardados() {
        const container = document.getElementById("informes-lista-container");
        if (!container) return;

        container.innerHTML = `
          <div class="text-center p-6">
            <p class="text-gray-500">Cargando informes guardados...</p>
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mt-2"></div>
          </div>
        `;

        try {
          const res = await fetch("obtener_informes.php", {
            cache: "no-store",
          });
          const text = await res.text();
          let data;
          try {
            data = JSON.parse(text);
          } catch (e) {
            throw new Error(
              `Respuesta inválida del servidor (no JSON). Inicio: ${text.substring(0, 200)}`
            );
          }

          if (!res.ok) {
            throw new Error(data?.message || `Error HTTP ${res.status}`);
          }

          // Formato esperado: { success, data: [], count }
          if (data && data.success && Array.isArray(data.data)) {
            informesGuardadosCache = data.data;
            populateOperadorInformeFilter(informesGuardadosCache);
            applyInformesFilters();
          } else if (Array.isArray(data)) {
            // Compatibilidad si devuelve array directo
            informesGuardadosCache = data;
            populateOperadorInformeFilter(informesGuardadosCache);
            applyInformesFilters();
          } else {
            container.innerHTML = `
              <div class="bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-yellow-800">
                ${data?.message || "No se pudo cargar la lista de informes."}
              </div>
            `;
            informesGuardadosCache = [];
            setInformesFilterSummary(0, 0);
          }

          const status = document.getElementById("db-status");
          if (status)
            status.textContent =
              "Estado de la Base de Datos: Conectado (MySQL)";
        } catch (error) {
          console.error("Error cargando informes (MySQL):", error);
          container.innerHTML = `
            <div class="bg-red-50 border border-red-200 p-4 rounded-lg">
              <p class="text-red-800 font-semibold">Error al cargar informes</p>
              <p class="text-red-700 text-sm mt-1">${String(
                error.message || error
              )}</p>
              <div class="mt-3 flex gap-2">
                <button onclick="cargarInformesGuardados()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Reintentar</button>
              </div>
            </div>
          `;
          const status = document.getElementById("db-status");
          if (status)
            status.textContent =
              "Estado de la Base de Datos: Error consultando MySQL";
        }
      }

      /**
       * Render de tarjetas de informes (MySQL)
       */
      function mostrarInformes(informes, container) {
        if (!informes || informes.length === 0) {
          const total = Array.isArray(informesGuardadosCache)
            ? informesGuardadosCache.length
            : 0;
          setInformesFilterSummary(0, total);
          container.innerHTML = `
            <div class="text-center p-10 bg-gray-50 rounded-lg">
                <svg class="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <h3 class="text-lg font-medium text-gray-700">No hay informes guardados</h3>
                <p class="text-gray-500 mt-2">Los informes que guardes aparecerán aquí.</p>
                <p class="text-gray-400 text-sm mt-1">Ve a la pestaña "06. Informe Ejecutivo" para crear uno.</p>
            </div>
          `;
          return;
        }

        // Resumen (si se llama directo sin applyInformesFilters)
        try {
          const total = Array.isArray(informesGuardadosCache)
            ? informesGuardadosCache.length
            : informes.length;
          setInformesFilterSummary(informes.length, total);
        } catch (e) {}

        // Ordenar por fecha_creacion (MySQL: string)
        informes.sort((a, b) => {
          const dateA = new Date(a.fecha_creacion || 0);
          const dateB = new Date(b.fecha_creacion || 0);
          return dateB - dateA;
        });

        let html = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">`;

        informes.forEach((informe) => {
          const id = parseInt(informe.id, 10) || 0;
          const titulo = informe.titulo?.toString() || "Sin título";
          const fechaDespacho =
            informe.fecha_despacho?.toString() || "No especificada";
          const operador =
            informe.operador_monitoreo?.toString() || "No especificado";

          let fechaFormateada = "Fecha no disponible";
          try {
            let fechaObj;
            if (informe.fecha_creacion && informe.fecha_creacion.toDate) {
              fechaObj = informe.fecha_creacion.toDate();
            } else if (informe.fecha_creacion) {
              fechaObj = new Date(informe.fecha_creacion);
            }
            if (fechaObj && !isNaN(fechaObj.getTime())) {
              fechaFormateada = fechaObj.toLocaleString("es-MX", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
            }
          } catch (e) {
            console.warn("Error formateando fecha:", e);
          }

          const totalDespachos = parseInt(informe.total_despachos) || 0;
          const aTiempo = parseInt(informe.a_tiempo) || 0;
          const conRetraso = parseInt(informe.con_retraso) || 0;
          const totalIncidencias = parseInt(informe.total_incidencias) || 0;

          html += `
            <div class="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow duration-300">
                <div class="p-5">
                    <!-- Encabezado -->
                    <div class="flex justify-between items-start mb-3">
                        <h3 class="font-bold text-lg text-blue-800 truncate" title="${titulo}">
                            ${titulo}
                        </h3>
                        <span class="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap">
                    ID: ${id || "N/A"}
                        </span>
                    </div>
                                        
                    <!-- Fecha -->
                    <div class="flex items-center text-sm text-gray-500 mb-4">
                        <svg class="w-4 h-4 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                        <span class="truncate">${fechaFormateada}</span>
                    </div>
                                        
                    <!-- Estadísticas -->
                    <div class="grid grid-cols-2 gap-3 mb-4">
                        <div class="bg-gray-50 p-3 rounded-lg">
                            <p class="text-xs text-gray-500">Total Despachos</p>
                            <p class="text-lg font-bold">${totalDespachos}</p>
                        </div>
                        <div class="bg-green-50 p-3 rounded-lg">
                            <p class="text-xs text-gray-500">A Tiempo</p>
                            <p class="text-lg font-bold text-green-600">${aTiempo}</p>
                        </div>
                        <div class="bg-red-50 p-3 rounded-lg">
                            <p class="text-xs text-gray-500">Con Retraso</p>
                            <p class="text-lg font-bold text-red-600">${conRetraso}</p>
                        </div>
                        <div class="bg-yellow-50 p-3 rounded-lg">
                            <p class="text-xs text-gray-500">Incidencias</p>
                            <p class="text-lg font-bold text-yellow-600">${totalIncidencias}</p>
                        </div>
                    </div>
                                        
                    <!-- Información adicional -->
                    <div class="text-sm text-gray-600 mb-4 space-y-1">
                        <p class="truncate"><strong class="text-gray-700">Operador:</strong> ${operador}</p>
                        <p><strong class="text-gray-700">Fecha Despacho:</strong> ${fechaDespacho}</p>
                    </div>
                                        
                    <!-- Botones -->
                    <div class="flex space-x-2">
                      <button onclick="window.verInformeDetalle(${id})"
                                 class="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors duration-200">
                            Ver Detalle
                        </button>
                      <button onclick="window.eliminarInforme(${id})"
                                 class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium transition-colors duration-200"
                                title="Eliminar informe">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
          `;
        });

        html += `</div>`;
        container.innerHTML = html;
      }

      /**
       * Carga y muestra el detalle de un informe desde MySQL (obtener_informe_detalle.php)
       */
      async function verInformeDetalle(id) {
        const numericId = parseInt(id, 10);
        if (!numericId || numericId <= 0) {
          openCustomAlert("ID de informe inválido.", "Error");
          return;
        }

        document.getElementById("modal-informe-body").innerHTML = `
          <div class="text-center p-6">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            <p class="mt-2 text-gray-500">Cargando detalles...</p>
          </div>
        `;
        document.getElementById("modal-informe-titulo").textContent =
          "Cargando...";
        openModal("modal-informe-detalle");

        try {
          const res = await fetch(
            `obtener_informe_detalle.php?id=${encodeURIComponent(numericId)}`,
            { cache: "no-store" }
          );
          const text = await res.text();
          let payload;
          try {
            payload = JSON.parse(text);
          } catch (e) {
            throw new Error(
              `Respuesta inválida del servidor (no JSON). Inicio: ${text.substring(0, 200)}`
            );
          }

          if (!res.ok || !payload?.success) {
            throw new Error(payload?.message || `Error HTTP ${res.status}`);
          }

          const row = payload.data || {};

          // Normalizar detalles
          let detalles = null;
          if (
            row.datos_informe_decoded &&
            Array.isArray(row.datos_informe_decoded)
          ) {
            detalles = row.datos_informe_decoded;
          } else if (row.datos_informe) {
            try {
              const decoded = JSON.parse(row.datos_informe);
              if (Array.isArray(decoded)) detalles = decoded;
            } catch (e) {}
          }

          const informeParaModal = {
            ...row,
            datos_detallados: detalles,
          };

          mostrarModalInforme(informeParaModal);
        } catch (error) {
          console.error("Error cargando detalle (MySQL):", error);
          document.getElementById("modal-informe-titulo").textContent = "Error";
          document.getElementById("modal-informe-body").innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
              <strong>No se pudo cargar el detalle:</strong> ${String(
                error.message || error
              )}
            </div>
          `;
        }
      }

      /**
       * Elimina un informe en MySQL (eliminar_informe.php)
       */
      async function eliminarInforme(id) {
        if (userRole !== "editor") {
          openCustomAlert(
            "No tienes permisos para eliminar informes.",
            "Permiso Denegado"
          );
          return;
        }

        const numericId = parseInt(id, 10);
        if (!numericId || numericId <= 0) {
          openCustomAlert("ID de informe inválido.", "Error");
          return;
        }

        const confirmed = prompt(
          `Escriba "ELIMINAR" para confirmar la eliminación del informe con ID: ${numericId}`
        );

        if (confirmed !== "ELIMINAR") return;

        try {
          const res = await fetch("eliminar_informe.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: numericId }),
          });

          const text = await res.text();
          let data;
          try {
            data = JSON.parse(text);
          } catch (e) {
            throw new Error(
              `Respuesta inválida del servidor (no JSON). Inicio: ${text.substring(0, 200)}`
            );
          }

          if (!res.ok || !data?.success) {
            throw new Error(data?.message || `Error HTTP ${res.status}`);
          }

          openCustomAlert(
            "✅ Informe eliminado correctamente",
            "Eliminación Exitosa"
          );
          // Recargar lista
          cargarInformesGuardados();
        } catch (error) {
          console.error("Error al eliminar el informe (MySQL):", error);
          openCustomAlert(
            `❌ Error al eliminar el informe: ${error.message}`,
            "Error"
          );
        }
      }

      // La función mostrarModalInforme se mantiene igual, pero usa datos_detallados
      function mostrarModalInforme(informe) {
        const FIELD_LABELS = {
          folio: "Folio",
          fechaProgramada: "Fecha programada",
          unidad: "Unidad",
          placas: "Placas",
          operador: "Operador",
          telefono: "Teléfono",
          ruta: "Ruta",
          origen: "Origen",
          destino: "Destino",
          citaSalidaUnidad: "Cita salida de unidad",
          citaCarga: "Cita de carga",
          citaSalida: "Cita salida de carga",
          citaDescarga: "Cita de descarga",
          realSalidaUnidad: "Real salida de unidad",
          realCarga: "Real cita de carga",
          realSalida: "Real salida de carga",
          realDescarga: "Real cita de descarga",
          realConfirmacionEntrega: "Real confirmación de entrega",
          confirmacionEntrega: "Confirmación de entrega",
          estatus: "Estatus",
          incidencias: "Incidencias",
          observaciones: "Observaciones",
          observacionesTimestamp: "Fecha observaciones",
          operadorMonitoreoId: "ID operador monitoreo",
          gpsValidacionEstado: "Estado GPS/Accesorios",
          gpsValidacionTimestamp: "Fecha validación GPS",
        };

        function escapeHtml(value) {
          return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
        }

        function formatFechaAmigable(value) {
          if (value === null || value === undefined) return "";
          if (typeof value !== "string") {
            // Manejar Timestamp de Firestore
            if (value.toDate) {
              value = value.toDate().toISOString();
            } else {
              return String(value);
            }
          }
          const trimmed = value.trim();
          if (!trimmed) return "";

          // Fecha simple YYYY-MM-DD
          if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            const d = dayjs(trimmed);
            return d.isValid() ? d.format("DD/MM/YYYY") : trimmed;
          }

          // ISO datetime
          const d = dayjs(trimmed);
          return d.isValid() && trimmed.includes("T")
            ? formatDateTime(trimmed)
            : trimmed;
        }

        function renderValue(key, value) {
          if (value === null || value === undefined || value === "") {
            return '<span class="text-gray-400">—</span>';
          }

          if (key === "incidencias") {
            if (!Array.isArray(value) || value.length === 0) {
              return '<span class="text-gray-500">Sin incidencias</span>';
            }

            return `
              <div class="space-y-2">
                ${value
                  .map((inc) => {
                    const sev = (inc?.severidad || "").toString().toLowerCase();
                    const sevClass = sev
                      ? `incidencia-${escapeHtml(sev)}`
                      : "bg-gray-50 text-gray-700 border-l-4 border-gray-300";
                    const tipo = escapeHtml(inc?.tipo || "Incidencia");
                    const fecha = escapeHtml(
                      formatFechaAmigable(inc?.fecha || "")
                    );
                    return `
                      <div class="text-sm p-2 rounded-md ${sevClass}">
                        <div class="font-semibold">${tipo}</div>
                        <div class="text-xs opacity-80">${fecha || "—"}</div>
                      </div>
                    `;
                  })
                  .join("")}
              </div>
            `;
          }

          if (typeof value === "boolean")
            return escapeHtml(value ? "Sí" : "No");
          if (typeof value === "number") return escapeHtml(value);

          // Fechas/horas
          const lowerKey = String(key).toLowerCase();
          const looksLikeDate =
            lowerKey.includes("fecha") ||
            lowerKey.includes("cita") ||
            lowerKey.includes("timestamp") ||
            lowerKey.startsWith("real");
          if (typeof value === "string" && looksLikeDate) {
            const formatted = formatFechaAmigable(value);
            return formatted
              ? escapeHtml(formatted)
              : '<span class="text-gray-400">—</span>';
          }
          // Manejar Timestamp de Firestore para campos generales
          if (value.toDate) {
            return escapeHtml(formatFechaAmigable(value));
          }

          return escapeHtml(value);
        }

        function renderCardViaje(viaje) {
          function labelForKey(key) {
            if (FIELD_LABELS[key]) return FIELD_LABELS[key];
            // Fallback: separar camelCase / snake_case y capitalizar
            return String(key)
              .replace(/_/g, " ")
              .replace(/([a-z])([A-Z])/g, "$1 $2")
              .replace(/^\w/, (c) => c.toUpperCase());
          }

          const estatus = (viaje?.estatus || "").toString();
          let badgeClass = "bg-gray-100 text-gray-700";
          if (estatus === "En ruta")
            badgeClass = "bg-yellow-100 text-yellow-800";
          else if (estatus === "Despacho realizado")
            badgeClass = "bg-green-100 text-green-800";
          else if (estatus === "Despacho No realizado")
            badgeClass = "bg-red-100 text-red-800";

          const ordenPreferida = [
            "folio",
            "fechaProgramada",
            "unidad",
            "placas",
            "operador",
            "telefono",
            "ruta",
            "origen",
            "destino",
            "citaSalidaUnidad",
            "citaCarga",
            "citaSalida",
            "citaDescarga",
            "realSalidaUnidad",
            "realCarga",
            "realSalida",
            "realDescarga",
            "realConfirmacionEntrega",
            "confirmacionEntrega",
            "estatus",
            "observaciones",
            "observacionesTimestamp",
            "operadorMonitoreoId",
            "gpsValidacionEstado",
            "gpsValidacionTimestamp",
          ];
          const keys = Object.keys(viaje || {});
          const orderedKeys = [
            ...ordenPreferida.filter((k) => keys.includes(k)),
            ...keys.filter((k) => !ordenPreferida.includes(k)),
          ];

          const rows = orderedKeys
            .filter((k) => k !== "incidencias")
            .map((k) => {
              const label = escapeHtml(labelForKey(k));
              const val = renderValue(k, viaje[k]);
              return `
                <div>
                  <dt class="text-xs text-gray-500">${label}</dt>
                  <dd class="text-sm font-medium text-gray-900 break-words">${val}</dd>
                </div>
              `;
            })
            .join("");

          const incidenciasHtml = `
            <div class="mt-4">
              <h6 class="text-sm font-semibold text-gray-800 mb-2">Incidencias</h6>
              ${renderValue("incidencias", (viaje && viaje.incidencias) || [])}
            </div>
          `;

          return `
            <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div class="flex items-start justify-between gap-3 mb-3">
                <div class="min-w-0">
                  <div class="font-bold text-gray-900 truncate">
                    ${escapeHtml(viaje?.unidad || "Sin unidad")}
                    <span class="text-gray-400 font-normal">·</span>
                    <span class="text-gray-600 font-semibold">Folio ${escapeHtml(
                      viaje?.folio ?? "—"
                    )}</span>
                  </div>
                  <div class="text-xs text-gray-500 truncate">
                    ${escapeHtml(viaje?.ruta || "")}
                  </div>
                </div>
                <span class="text-xs font-semibold px-2.5 py-1 rounded-full ${badgeClass} whitespace-nowrap">
                  ${escapeHtml(estatus || "Sin estatus")}
                </span>
              </div>

              <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                ${rows}
              </dl>

              ${incidenciasHtml}
            </div>
          `;
        }

        // Título
        document.getElementById("modal-informe-titulo").textContent =
          informe.titulo || "Sin título";

        // Formatear fecha de creación (manejar Timestamp de Firestore)
        let fechaCreacion = "No disponible";
        try {
          let fechaObj;
          if (informe.fecha_creacion && informe.fecha_creacion.toDate) {
            fechaObj = informe.fecha_creacion.toDate();
          } else if (informe.fecha_creacion) {
            fechaObj = new Date(informe.fecha_creacion);
          }
          if (fechaObj && !isNaN(fechaObj.getTime())) {
            fechaCreacion = fechaObj.toLocaleString("es-MX", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
          }
        } catch (e) {
          console.warn("Error formateando fecha:", e);
        }

        let html = `
        <div class="space-y-6">
            <!-- Estadísticas principales -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="bg-gray-100 p-4 rounded-lg text-center">
                    <p class="text-sm font-medium text-gray-600">Total Despachos</p>
                    <p class="text-2xl font-bold mt-1">${informe.total_despachos || 0}</p>
                </div>
                <div class="bg-green-100 p-4 rounded-lg text-center">
                    <p class="text-sm font-medium text-green-700">A Tiempo</p>
                    <p class="text-2xl font-bold text-green-800 mt-1">${informe.a_tiempo || 0}</p>
                </div>
                <div class="bg-red-100 p-4 rounded-lg text-center">
                    <p class="text-sm font-medium text-red-700">Con Retraso</p>
                    <p class="text-2xl font-bold text-red-800 mt-1">${informe.con_retraso || 0}</p>
                </div>
                <div class="bg-yellow-100 p-4 rounded-lg text-center">
                    <p class="text-sm font-medium text-yellow-700">Incidencias</p>
                    <p class="text-2xl font-bold text-yellow-800 mt-1">${informe.total_incidencias || 0}</p>
                </div>
            </div>
                        
            <!-- Información general -->
            <div class="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <h4 class="font-semibold text-blue-800 mb-2">Información General</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <p><span class="font-medium text-gray-700">Fecha de creación:</span> ${fechaCreacion}</p>
                    <p><span class="font-medium text-gray-700">Fecha de despacho:</span> ${informe.fecha_despacho || "No especificada"}</p>
                    <p><span class="font-medium text-gray-700">Operador:</span> ${informe.operador_monitoreo || "No especificado"}</p>
                    <p><span class="font-medium text-gray-700">ID del informe:</span> ${informe.id || "N/A"}</p>
                </div>
            </div>
        `;

        // Mostrar datos detallados si existen
        if (
          informe.datos_detallados &&
          Array.isArray(informe.datos_detallados)
        ) {
          const detalles = informe.datos_detallados;

          html += `
            <div>
                <h4 class="font-semibold text-gray-800 mb-3">Detalles de Viajes (${detalles.length} registros)</h4>
                                
                <!-- Viajes en formato Card -->
                <div class="mt-4">
                  <div class="max-h-96 overflow-y-auto pr-1">
                  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    ${detalles.map((v) => renderCardViaje(v)).join("")}
                  </div>
                  </div>
                </div>
            </div>
                    `;
        } else {
          html += `
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 class="font-semibold text-yellow-800 mb-2">Advertencia de Datos</h4>
                <p class="text-sm text-yellow-700">No se pudieron cargar o decodificar los datos detallados del viaje.</p>
            </div>
          `;
        }

        html += `</div>`;

        document.getElementById("modal-informe-body").innerHTML = html;
      }

      // === 911 por estados (carga interna y filtros) ===

      const EMBEDDED_911_DATA = [
        {
          estado: "AGUASCALIENTES",
          municipio: "AGUASCALIENTES",
          tel: "4499106257",
        },
        { estado: "AGUASCALIENTES", municipio: "ASIENTOS", tel: "4499106257" },
        { estado: "AGUASCALIENTES", municipio: "CALVILLO", tel: "4499106257" },
        { estado: "AGUASCALIENTES", municipio: "COSIO", tel: "4499106257" },
        { estado: "AGUASCALIENTES", municipio: "EL LLANO", tel: "4499106257" },
        {
          estado: "AGUASCALIENTES",
          municipio: "JESUS MARIA",
          tel: "4499106257",
        },
        {
          estado: "AGUASCALIENTES",
          municipio: "PABELLON DE ARTEAGA",
          tel: "4499106257",
        },
        {
          estado: "AGUASCALIENTES",
          municipio: "RINCON DE ROMOS",
          tel: "4499106257",
        },
        {
          estado: "AGUASCALIENTES",
          municipio: "SAN FRANCISCO DE LOS ROMO",
          tel: "4499106257",
        },
        {
          estado: "AGUASCALIENTES",
          municipio: "SAN JOSE DE GRACIA",
          tel: "4499106257",
        },
        { estado: "AGUASCALIENTES", municipio: "TEPEZALA", tel: "4499106257" },

        { estado: "BAJA CALIFORNIA", municipio: "ENSENADA", tel: "6461723501" },
        { estado: "BAJA CALIFORNIA", municipio: "MEXICALI", tel: "6865598001" },
        {
          estado: "BAJA CALIFORNIA",
          municipio: "PLAYAS DE ROSARITO",
          tel: "6616130001",
        },

        { estado: "ZACATECAS", municipio: "CALERA", tel: "4789852648" },
        {
          estado: "ZACATECAS",
          municipio: "CAÑITAS DE FELIPE PESCADOR",
          tel: "4939332700",
        },
        {
          estado: "ZACATECAS",
          municipio: "CONCEPCION DEL ORO",
          tel: "4929239406",
        },
        { estado: "ZACATECAS", municipio: "CUAUHTEMOC", tel: "4929239406" },
        { estado: "ZACATECAS", municipio: "CHALCHIHUITES", tel: "4929239406" },
        { estado: "ZACATECAS", municipio: "FRESNILLO", tel: "4939332700" },
        { estado: "ZACATECAS", municipio: "GENARO CODINA", tel: "4929239406" },
        {
          estado: "ZACATECAS",
          municipio: "GENERAL ENRIQUE ESTRADA",
          tel: "4789852648",
        },
        {
          estado: "ZACATECAS",
          municipio: "GENERAL FRANCISCO R. MURGUIA",
          tel: "4989839900",
        },
        {
          estado: "ZACATECAS",
          municipio: "GENERAL PANFILO NATERA",
          tel: "4929239406",
        },
        { estado: "ZACATECAS", municipio: "GUADALUPE", tel: "4929239406" },
        { estado: "ZACATECAS", municipio: "HUANUSCO", tel: "4929239406" },
        { estado: "ZACATECAS", municipio: "JALPA", tel: "4929239406" },
        { estado: "ZACATECAS", municipio: "JEREZ", tel: "4949453305" },
        {
          estado: "ZACATECAS",
          municipio: "JIMENEZ DEL TEUL",
          tel: "4929239406",
        },
        { estado: "ZACATECAS", municipio: "JUAN ALDAMA", tel: "4989839900" },
        { estado: "ZACATECAS", municipio: "JUCHIPILA", tel: "4929239406" },
        { estado: "ZACATECAS", municipio: "LORETO", tel: "4929239406" },
        {
          estado: "CIUDAD DE MEXICO",
          municipio: "CIUDAD DE MEXICO",
          tel: "5556581111",
        },
        {
          estado: "BAJA CALIFORNIA SUR",
          municipio: "LA PAZ",
          tel: "6121221150",
        },
        { estado: "CAMPECHE", municipio: "CAMPECHE", tel: "9818160249" },
        { estado: "CHIAPAS", municipio: "TUXTLA GUTIERREZ", tel: "9616170600" },
        { estado: "CHIHUAHUA", municipio: "CHIHUAHUA", tel: "6144293300" },
        { estado: "COAHUILA", municipio: "SALTILLO", tel: "8444383000" },
        { estado: "COLIMA", municipio: "COLIMA", tel: "3123164000" },
        { estado: "DURANGO", municipio: "DURANGO", tel: "6181373300" },
        { estado: "ESTADO DE MEXICO", municipio: "TOLUCA", tel: "7222152865" },
        { estado: "GUANAJUATO", municipio: "LEON", tel: "4777174640" },
        { estado: "GUERRERO", municipio: "ACAPULCO", tel: "7444855000" },
        { estado: "HIDALGO", municipio: "PACHUCA", tel: "7717173000" },
        { estado: "JALISCO", municipio: "GUADALAJARA", tel: "3336681900" },
        { estado: "MICHOACAN", municipio: "MORELIA", tel: "4433120000" },
        { estado: "MORELOS", municipio: "CUERNAVACA", tel: "7773121000" },
        { estado: "NUEVO LEON", municipio: "MONTERREY", tel: "8183457755" },
        { estado: "OAXACA", municipio: "OAXACA", tel: "9515020000" },
        { estado: "PUEBLA", municipio: "PUEBLA", tel: "2223094800" },
        { estado: "QUERETARO", municipio: "QUERETARO", tel: "4422115100" },
        { estado: "QUINTANA ROO", municipio: "CANCUN", tel: "9988811400" },
        {
          estado: "SAN LUIS POTOSI",
          municipio: "SAN LUIS POTOSI",
          tel: "4448110000",
        },
        { estado: "SINALOA", municipio: "CULIACAN", tel: "6677587000" },
        { estado: "SONORA", municipio: "HERMOSILLO", tel: "6622894600" },
        { estado: "TABASCO", municipio: "VILLAHERMOSA", tel: "9933130000" },
        {
          estado: "TAMAULIPAS",
          municipio: "CIUDAD VICTORIA",
          tel: "8343186000",
        },
        { estado: "TLAXCALA", municipio: "TLAXCALA", tel: "2464650900" },
        { estado: "VERACRUZ", municipio: "XALAPA", tel: "2288419700" },
        { estado: "YUCATAN", municipio: "MERIDA", tel: "9999303000" },
      ];

      let emergency911Cache = {
        loaded: false,
        rows: [], // {estado, municipio, tel}
        filtered: [],
        states: [],
        pageSize: 100, // cuánto muestra cada vez
        currentLimit: 100,
      };

      async function openEmergency911Modal() {
        openModal("emergency911-modal");

        const status = document.getElementById("em911-status");
        if (status)
          status.textContent = emergency911Cache.loaded
            ? "Cargado."
            : "Cargando directorio de emergencia...";

        if (!emergency911Cache.loaded) {
          try {
            await loadEmergency911Data();
            emergency911Cache.loaded = true;
            setupEmergency911StateSelector();
            applyEmergency911Filters();
          } catch (e) {
            if (status) {
              status.innerHTML = `
                <div class="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700">
                  <strong>Error al cargar directorio:</strong> ${String(e.message || e)}
                </div>`;
            }
          }
        } else {
          applyEmergency911Filters();
        }
      }
      

      const EMERGENCY_CONTACTS = [
        { label:"Contacto 1", nombre:"Nombre Apellido", cargo:"Cargo", departamento:"Departamento", telefonos:["+52 55 0000 0000","+52 55 0000 0001"], correos:["correo1@empresa.com","correo2@empresa.com"] },
        { label:"Contacto 2", nombre:"Nombre Apellido", cargo:"Cargo", departamento:"Departamento", telefonos:["+52 55 0000 0002"], correos:["correo@empresa.com"] },
        { label:"Contacto 3", nombre:"Nombre Apellido", cargo:"Cargo", departamento:"Departamento", telefonos:["+52 55 0000 0003"], correos:["correo@empresa.com"] },
        { label:"Contacto 4", nombre:"Nombre Apellido", cargo:"Cargo", departamento:"Departamento", telefonos:["+52 55 0000 0004"], correos:["correo@empresa.com"] },
      ];

      function openEmergencyContactsModal(){
        const body = document.getElementById("emergency-contacts-body");
        const modal = document.getElementById("emergency-contacts-modal");

        // En producción, si estás usando otro HTML (p.ej. update.html) que no trae el modal,
        // esto antes tronaba con "Cannot set properties of null".
        if (!body || !modal) {
          console.error(
            "No se encontró el modal de contactos de emergencia en el DOM.",
            { bodyFound: Boolean(body), modalFound: Boolean(modal) }
          );
          if (typeof openCustomAlert === "function") {
            openCustomAlert(
              "No se encontró el modal de Contactos de Emergencia en esta página. Verifica que estés usando el HTML correcto (el que incluye #emergency-contacts-modal).",
              "Configuración"
            );
          }
          return;
        }

        body.innerHTML = EMERGENCY_CONTACTS.map(c=>`
          <div class="border rounded-xl p-4 shadow-sm bg-white">
            <p class="text-sm font-semibold text-gray-800">${escapeHtml(c.label)}</p>
            <p class="text-lg font-bold text-emerald-700 mt-1">${escapeHtml(c.nombre)}</p>
            <p class="text-sm text-gray-600">${escapeHtml(c.cargo)} · ${escapeHtml(c.departamento)}</p>
            <div class="mt-3 text-sm text-gray-700">
              <p class="font-semibold">Teléfonos</p>
              <ul class="list-disc ml-5">${(c.telefonos||[]).map(t=>`<li class="font-medium">${escapeHtml(t)}</li>`).join("")}</ul>
              <p class="font-semibold mt-3">Correos</p>
              <ul class="list-disc ml-5">${(c.correos||[]).map(e=>`<li>${escapeHtml(e)}</li>`).join("")}</ul>
            </div>
          </div>
        `).join("");
        openModal("emergency-contacts-modal");
      }

      async function loadEmergency911Data() {
        // Usa datos embebidos en lugar de fetch
        const rows = EMBEDDED_911_DATA.map((r) => ({
          estado: r.estado,
          municipio: r.municipio,
          tel: String(r.tel || "")
            .trim()
            .replace(/\.0$/, ""),
        }));

        emergency911Cache.rows = rows.filter(
          (r) => r.estado && r.municipio && r.tel
        );
        // Ordenar estados y municipios al cargar
        emergency911Cache.states = [
          ...new Set(emergency911Cache.rows.map((x) => x.estado)),
        ].sort((a, b) => a.localeCompare(b));
        emergency911Cache.rows.sort((a, b) => {
          const stateCompare = a.estado.localeCompare(b.estado);
          if (stateCompare !== 0) return stateCompare;
          return a.municipio.localeCompare(b.municipio);
        });

        emergency911Cache.currentLimit = emergency911Cache.pageSize;
      }

      function setupEmergency911StateSelector() {
        const sel = document.getElementById("em911-estado");
        if (!sel) return;

        sel.innerHTML = `<option value="all">Todos los estados</option>`;
        emergency911Cache.states.forEach((st) => {
          const opt = document.createElement("option");
          opt.value = st;
          opt.textContent = st;
          sel.appendChild(opt);
        });
      }

      function applyEmergency911Filters() {
        const sel = document.getElementById("em911-estado");
        const q = document.getElementById("em911-search");

        const estado = sel ? sel.value : "all";
        const term = (q ? q.value : "").trim().toLowerCase();

        let filtered = emergency911Cache.rows;

        if (estado !== "all")
          filtered = filtered.filter((r) => r.estado === estado);
        if (term)
          filtered = filtered.filter((r) =>
            r.municipio.toLowerCase().includes(term)
          );

        emergency911Cache.filtered = filtered;
        emergency911Cache.currentLimit = emergency911Cache.pageSize; // Reset limit on new filter
        renderEmergency911Table();
      }

      function loadMoreEmergency911Rows() {
        const max = emergency911Cache.filtered.length;
        emergency911Cache.currentLimit = Math.min(
          emergency911Cache.currentLimit + emergency911Cache.pageSize,
          max
        );
        renderEmergency911Table();
      }

      function renderEmergency911Table() {
        const tbody = document.getElementById("em911-tbody");
        const status = document.getElementById("em911-status");
        if (!tbody || !status) return;

        const total = emergency911Cache.filtered.length;
        const show = emergency911Cache.currentLimit;

        status.textContent = `Mostrando ${Math.min(show, total)} de ${total} registros.`;

        const slice = emergency911Cache.filtered.slice(0, show);
        tbody.innerHTML = slice
          .map(
            (r) => `
          <tr>
            <td class="px-4 py-2 whitespace-nowrap">${escapeHtml(r.estado)}</td>
            <td class="px-4 py-2">${escapeHtml(r.municipio)}</td>
            <td class="px-4 py-2 font-semibold">${escapeHtml(r.tel)}</td>
          </tr>
        `
          )
          .join("");

        if (total === 0) {
          tbody.innerHTML = `<tr><td class="px-4 py-4 text-gray-500" colspan="3">Sin resultados.</td></tr>`;
        }
      }

      function escapeHtml(value) {
        return String(value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }