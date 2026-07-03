// Al inicio del archivo, antes de la declaración de variables
const STORAGE_KEY = 'figaroData';

// Estructura de datos para almacenar la información por año y mes
let allYearsData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
let financialData = {};
let currentMonth = '';
let selectedYear = new Date().getFullYear();

/* --- Column resizing utilities --- */
function setupResizableHeaders(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const header = table.querySelector('thead tr');
    if (!header) return;

    // Add resizer handles to each th if not already present
    Array.from(header.children).forEach((th, idx) => {
        if (!th.querySelector('.th-resizer')) {
            const resizer = document.createElement('div');
            resizer.className = 'th-resizer';
            resizer.dataset.colIndex = idx;
            th.appendChild(resizer);

            resizer.addEventListener('mousedown', initResize);
            // also support touch
            resizer.addEventListener('touchstart', initResize, { passive: true });
        }
    });
}

let resizing = {
    tableId: null,
    startX: 0,
    startWidth: 0,
    colIndex: 0,
    th: null
};

function initResize(e) {
    e.preventDefault();
    const isTouch = e.type === 'touchstart';
    const target = isTouch ? e.targetTouches[0] : e;
    const resizer = isTouch ? e.target : e.target;
    const th = resizer.parentElement;
    const table = th.closest('table');
    resizing.tableId = table.id;
    resizing.th = th;
    resizing.colIndex = Number(resizer.dataset.colIndex);
    resizing.startX = isTouch ? target.clientX : e.clientX;
    resizing.startWidth = th.offsetWidth;
    document.addEventListener(isTouch ? 'touchmove' : 'mousemove', doResize, { passive: false });
    document.addEventListener(isTouch ? 'touchend' : 'mouseup', stopResize);
}

function doResize(e) {
    const isTouch = e.type === 'touchmove';
    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
    const dx = clientX - resizing.startX;
    const newWidth = Math.max(50, resizing.startWidth + dx);
    // Set width on th and corresponding tds via colgroup-less approach: set inline style on all cells of that column
    const table = document.getElementById(resizing.tableId);
    if (!table) return;
    // Apply to header cell
    resizing.th.style.width = newWidth + 'px';
    // Apply to every row cell at same index
    Array.from(table.querySelectorAll('tbody tr')).forEach(row => {
        const cell = row.children[resizing.colIndex];
        if (cell) cell.style.width = newWidth + 'px';
    });
    // Save width to year settings
    saveColumnWidthForYear(selectedYear, resizing.tableId, resizing.colIndex, newWidth);
    e.preventDefault();
}

function stopResize(e) {
    const isTouch = e.type === 'touchend';
    document.removeEventListener(isTouch ? 'touchmove' : 'mousemove', doResize);
    document.removeEventListener(isTouch ? 'touchend' : 'mouseup', stopResize);
    resizing = { tableId: null, startX: 0, startWidth: 0, colIndex: 0, th: null };
}

function saveColumnWidthForYear(year, tableId, colIndex, width) {
    if (!allYearsData[year]) allYearsData[year] = {};
    if (!allYearsData[year].columnWidths) allYearsData[year].columnWidths = {};
    if (!allYearsData[year].columnWidths[tableId]) allYearsData[year].columnWidths[tableId] = {};
    allYearsData[year].columnWidths[tableId][colIndex] = width;
    saveData();
}

function applyStoredColumnWidths(tableId) {
    const wd = allYearsData[selectedYear] && allYearsData[selectedYear].columnWidths && allYearsData[selectedYear].columnWidths[tableId];
    const table = document.getElementById(tableId);
    if (!table || !wd) return;
    const headerCells = table.querySelectorAll('thead tr th');
    headerCells.forEach((th, idx) => {
        const w = wd[idx];
        if (w) {
            th.style.width = w + 'px';
            Array.from(table.querySelectorAll('tbody tr')).forEach(row => {
                const cell = row.children[idx];
                if (cell) cell.style.width = w + 'px';
            });
        }
    });
}

/* Small helper to avoid injection when rendering values into inputs */
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// Inicializar la aplicación
function init() {
    // Asegurarse de que existan datos para el año seleccionado
    if (!allYearsData[selectedYear]) {
        allYearsData[selectedYear] = {};
    }
    financialData = allYearsData[selectedYear];

    // Limpiar las pestañas existentes
    const tabsContainer = document.getElementById('monthTabs');
    tabsContainer.innerHTML = '';
    
    // Crear pestañas para los últimos 12 meses
    const months = getLastTwelveMonths();
    
    months.forEach((month) => {
        const tab = document.createElement('button');
        tab.className = 'tab';
        tab.textContent = month;
        tab.onclick = () => selectMonth(month);
        tabsContainer.appendChild(tab);
        
        // Inicializar datos del mes si no existen
        if (!financialData[month]) {
            financialData[month] = {
                income: [],
                expenses: []
            };
        }
    });
    
    // Seleccionar el mes actual o el primer mes si no hay mes actual
    selectMonth(currentMonth || months[0]);

    // Render historical summary on initialization
    renderHistoricalSummary();
}

function getLastTwelveMonths() {
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return monthNames;
}

function selectMonth(month) {
    currentMonth = month;
    // Actualizar pestañas activas
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.toggle('active', tab.textContent === month);
    });
    
    // Cargar datos del mes
    loadMonthData();
}

function loadMonthData() {
    const data = financialData[currentMonth];
    
    // Cargar ingresos
    const incomeBody = document.getElementById('incomeBody');
    incomeBody.innerHTML = '';
    data.income.forEach((item, index) => {
        const row = createIncomeRow(item, index);
        incomeBody.appendChild(row);
    });
    
    // Cargar egresos
    const expensesBody = document.getElementById('expensesBody');
    expensesBody.innerHTML = '';
    data.expenses.forEach((item, index) => {
        const row = createExpenseRow(item, index);
        expensesBody.appendChild(row);
    });

    // Ensure inputs adapt to column width (in case rows were created programmatically)
    // inputs already use width:100% in CSS; but enforce style in case inline widths were set
    document.querySelectorAll('#incomeTable tbody tr td input, #expensesTable tbody tr td input').forEach(inp => {
        inp.style.width = '100%';
        inp.style.boxSizing = 'border-box';
    });

    // Apply any stored column widths for the selected year so the change reflects across months
    applyStoredColumnWidths('incomeTable');
    applyStoredColumnWidths('expensesTable');

    // Add resizer handles to headers (idempotent)
    setupResizableHeaders('incomeTable');
    setupResizableHeaders('expensesTable');

    updateTotals();
}

// Función auxiliar para formatear números como pesos chilenos
function formatCLP(number) {
    return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(number);
}

function createIncomeRow(item = {}, index) {
    const tr = document.createElement('tr');
    const formattedAmount = item.amount ? formatCLPInput(item.amount) : '';
    tr.innerHTML = `
        <td><input type="text" value="${item.description || ''}" onchange="updateIncome(${index}, 'description', this.value)"></td>
        <td>
            <div style="display: flex; align-items: center; justify-content: space-between">
                <input type="text" value="${formattedAmount}" 
                    onchange="handleCurrencyInput(this, ${index}, 'income')"
                    onkeyup="formatCurrencyInput(this)"
                    onblur="formatCurrencyInput(this)">
                <button class="delete-btn" onclick="deleteIncome(${index})">×</button>
            </div>
        </td>
    `;
    return tr;
}

function createExpenseRow(item = {}, index) {
    const tr = document.createElement('tr');
    const secondFloorValue = calculateSecondFloor(item.amount || 0, item.percentage || 0);
    const formattedAmount = item.amount ? formatCLPInput(item.amount) : '';
    tr.innerHTML = `
        <td><input type="text" value="${item.description || ''}" onchange="updateExpense(${index}, 'description', this.value)"></td>
        <td>
            <div style="display: flex; align-items: center; justify-content: space-between">
                <input type="text" value="${formattedAmount}" 
                    onchange="handleCurrencyInput(this, ${index}, 'expense')"
                    onkeyup="formatCurrencyInput(this)"
                    onblur="formatCurrencyInput(this)">
                <button class="delete-btn" onclick="deleteExpense(${index})">×</button>
            </div>
        </td>
        <td>
            <div class="second-floor-cell">
                <input type="number" class="percentage-input" value="${item.percentage || 0}" 
                       onchange="updateExpense(${index}, 'percentage', this.value)">%
                <span>${formatCLP(secondFloorValue)}</span>
            </div>
        </td>
    `;
    return tr;
}

function addIncomeRow() {
    financialData[currentMonth].income.push({
        description: '',
        amount: 0
    });
    loadMonthData();
}

function addExpenseRow() {
    financialData[currentMonth].expenses.push({
        description: '',
        amount: 0,
        percentage: 0
    });
    loadMonthData();
}

function updateIncome(index, field, value) {
    financialData[currentMonth].income[index][field] = field === 'amount' ? Number(value) : value;
    updateTotals();
    saveData();
}

function updateExpense(index, field, value) {
    const expense = financialData[currentMonth].expenses[index];
    expense[field] = field === 'amount' || field === 'percentage' ? Number(value) : value;
    loadMonthData();
    saveData();
}

function calculateSecondFloor(amount, percentage) {
    return (amount * percentage) / 100;
}

function updateTotals() {
    const data = financialData[currentMonth];
    
    // Calcular total de ingresos
    const totalIncome = data.income.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    document.getElementById('totalIncome').textContent = formatCLP(totalIncome);
    
    // Calcular total de egresos y 2do piso
    const totalExpenses = data.expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const total2ndFloor = data.expenses.reduce((sum, item) => {
        return sum + calculateSecondFloor(item.amount || 0, item.percentage || 0);
    }, 0);
    
    document.getElementById('totalExpenses').textContent = formatCLP(totalExpenses);
    document.getElementById('total2ndFloor').textContent = formatCLP(total2ndFloor);
    
    // Calcular balance final
    const finalBalance = totalIncome - totalExpenses;
    document.getElementById('finalBalance').textContent = formatCLP(finalBalance);

    // Calcular balance del mismo mes en año anterior y variación mensual
    const prevYear = selectedYear - 1;
    let prevMonthBalance = 0;
    if (allYearsData[prevYear] && allYearsData[prevYear][currentMonth]) {
        const pm = allYearsData[prevYear][currentMonth];
        const prevIncome = Array.isArray(pm.income) ? pm.income.reduce((s,i) => s + (Number(i.amount)||0), 0) : 0;
        const prevExpenses = Array.isArray(pm.expenses) ? pm.expenses.reduce((s,i) => s + (Number(i.amount)||0), 0) : 0;
        prevMonthBalance = prevIncome - prevExpenses;
    }
    const prevBalanceEl = document.getElementById('prevMonthBalance');
    const monthVarEl = document.getElementById('monthVariation');
    if (prevBalanceEl) prevBalanceEl.textContent = formatCLP(prevMonthBalance);

    // Calculate percentage variation for the month (compared to previous year's same month)
    let monthVariation = 0;
    if (prevMonthBalance === 0) {
        monthVariation = finalBalance > 0 ? 100 : 0;
    } else {
        monthVariation = ((finalBalance - prevMonthBalance) / Math.abs(prevMonthBalance)) * 100;
    }
    if (monthVarEl) {
        monthVarEl.textContent = `${monthVariation.toFixed(1)}%`;
        monthVarEl.className = monthVariation > 0 ? 'variation-positive' : 'variation-negative';
    }

    // Actualizar indicadores anuales
    updateAnnualIndicators();
    
    // Guardar datos después de cada actualización
    saveData();
}

function updateAnnualIndicators() {
    // Current year indicators
    const currentYearData = getYearTotals(selectedYear);
    document.getElementById('annualProfit').textContent = formatCLP(currentYearData.totalProfit);
    document.getElementById('averageMonthlyProfit').textContent = formatCLP(currentYearData.avgProfit);
    document.getElementById('averageMonthlyIncome').textContent = formatCLP(currentYearData.avgIncome);

    // Previous year indicators
    const prevYearData = getYearTotals(selectedYear - 1);
    document.getElementById('prevAnnualProfit').textContent = formatCLP(prevYearData.totalProfit);
    document.getElementById('prevAverageMonthlyProfit').textContent = formatCLP(prevYearData.avgProfit);
    document.getElementById('prevAverageMonthlyIncome').textContent = formatCLP(prevYearData.avgIncome);

    // Calculate and update variations
    updateVariations(currentYearData, prevYearData);
}

function getYearTotals(year) {
    let totalIncome = 0;
    let totalExpenses = 0;
    let monthsWithData = 0;

    const yearData = allYearsData[year];
    if (yearData && typeof yearData === 'object') {
        Object.values(yearData).forEach(monthData => {
            // Guard against undefined or malformed monthData
            if (!monthData || typeof monthData !== 'object') return;
            const incomeArray = Array.isArray(monthData.income) ? monthData.income : [];
            const expensesArray = Array.isArray(monthData.expenses) ? monthData.expenses : [];

            const monthIncome = incomeArray.reduce((sum, item) => sum + (Number(item && item.amount) || 0), 0);
            const monthExpenses = expensesArray.reduce((sum, item) => sum + (Number(item && item.amount) || 0), 0);

            if (monthIncome > 0 || monthExpenses > 0) {
                monthsWithData++;
                totalIncome += monthIncome;
                totalExpenses += monthExpenses;
            }
        });
    }

    const totalProfit = totalIncome - totalExpenses;
    const avgProfit = monthsWithData > 0 ? totalProfit / monthsWithData : 0;
    const avgIncome = monthsWithData > 0 ? totalIncome / monthsWithData : 0;

    return {
        totalProfit,
        avgProfit,
        avgIncome,
        monthsWithData
    };
}

function updateVariations(currentData, prevData) {
    if (prevData.monthsWithData === 0) {
        setVariation('profitVariation', 0);
        setVariation('avgProfitVariation', 0);
        setVariation('avgIncomeVariation', 0);
        return;
    }

    // Calculate percentage variations
    const profitVariation = calculateVariationPercentage(currentData.totalProfit, prevData.totalProfit);
    const avgProfitVariation = calculateVariationPercentage(currentData.avgProfit, prevData.avgProfit);
    const avgIncomeVariation = calculateVariationPercentage(currentData.avgIncome, prevData.avgIncome);

    // Update DOM elements
    setVariation('profitVariation', profitVariation);
    setVariation('avgProfitVariation', avgProfitVariation);
    setVariation('avgIncomeVariation', avgIncomeVariation);
}

function calculateVariationPercentage(current, previous) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / Math.abs(previous)) * 100;
}

/* Render the historical summary table supporting multiple dynamic year columns.
   Columns to show are stored in allYearsData._historicalYears (array of year numbers).
   If not present, default to [2022]. */
function renderHistoricalSummary() {
    const months = getLastTwelveMonths();
    const tbody = document.getElementById('historicalBody');
    if (!tbody) return;

    // Ensure arrays to track manual edits and visible years and headers
    if (!allYearsData._historicalManual) allYearsData._historicalManual = {};
    if (!allYearsData._historicalHeaders) allYearsData._historicalHeaders = {};
    if (!allYearsData._historicalYears || !Array.isArray(allYearsData._historicalYears) || allYearsData._historicalYears.length === 0) {
        allYearsData._historicalYears = [2022];
    }
    const yearsToShow = allYearsData._historicalYears.slice(); // e.g. [2022, 2023, ...]

    // Ensure header placeholders exist
    yearsToShow.forEach(y => {
        if (!allYearsData._historicalHeaders[y]) {
            allYearsData._historicalHeaders[y] = { yearLabel: String(y), sub: ['ALDO', 'MARCOS'] };
        }
    });

    // helper: get manual month object for a given year+month
    function getManual(year, month) {
        if (!allYearsData._historicalManual[year]) return { aldo: { bruto: 0, liq: 0, pct: 0 }, marcos: { bruto: 0, liq: 0, pct: 0 } };
        return allYearsData._historicalManual[year][month] || { aldo: { bruto: 0, liq: 0, pct: 0 }, marcos: { bruto: 0, liq: 0, pct: 0 } };
    }

    // helper: get computed totals from stored years for a given year+month
    function monthValues(year, month) {
        const ydata = allYearsData[year];
        if (!ydata || !ydata[month]) return { income: 0, expenses: 0, profit: 0 };
        const m = ydata[month];
        const income = Array.isArray(m.income) ? m.income.reduce((s, i) => s + (Number(i.amount) || 0), 0) : 0;
        const expenses = Array.isArray(m.expenses) ? m.expenses.reduce((s, i) => s + (Number(i.amount) || 0), 0) : 0;
        const profit = income - expenses;
        return { income, expenses, profit };
    }

    // Build the table header (replace existing thead)
    const table = document.querySelector('.historical-table');
    if (!table) return;
    const thead = table.querySelector('thead');
    thead.innerHTML = '';

    // First header row: MES, TOTALES, then one colspan=2 per year
    const tr1 = document.createElement('tr');
    const thMonth = document.createElement('th');
    thMonth.rowSpan = 2;
    thMonth.textContent = 'MES';
    tr1.appendChild(thMonth);

    const thTotals = document.createElement('th');
    thTotals.rowSpan = 2;
    thTotals.innerHTML = `<div class="totals-header"><span class="totals-title">TOTALES</span><button class="plus-icon" aria-label="Agregar" onclick="addHistoricalYearColumn()">+</button></div>`;
    tr1.appendChild(thTotals);

    yearsToShow.forEach(y => {
        const headerInfo = allYearsData._historicalHeaders[y] || { yearLabel: String(y), sub: ['ALDO', 'MARCOS'] };
        const thYear = document.createElement('th');
        thYear.colSpan = 2;
        // build year header with a delete button on the right and enable double-click editing
        thYear.innerHTML = `<div class="year-header" style="position:relative; width:100%; box-sizing:border-box; cursor: default;">
                                <span class="year-label" style="display:inline-block; width:100%; text-align:center;">${escapeHtml(headerInfo.yearLabel)}</span>
                                <button style="position:absolute; right:4px; top:50%; transform:translateY(-50%); width:26px; height:26px; border-radius:50%; border:none; background:rgba(255,255,255,0.18); color:#fff; cursor:pointer;" aria-label="Eliminar año ${String(y)}" onclick="deleteHistoricalYear(${Number(y)})">×</button>
                            </div>`;
        // dblclick handler to edit year label
        thYear.addEventListener('dblclick', (ev) => {
            ev.stopPropagation();
            startEditHeaderYear(y, thYear);
        });
        tr1.appendChild(thYear);
    });

    thead.appendChild(tr1);

    // Second header row: ALDO / MARCOS repeated for each year (editable)
    const tr2 = document.createElement('tr');
    yearsToShow.forEach(y => {
        const headerInfo = allYearsData._historicalHeaders[y] || { yearLabel: String(y), sub: ['ALDO', 'MARCOS'] };

        const thA = document.createElement('th');
        thA.textContent = headerInfo.sub && headerInfo.sub[0] ? headerInfo.sub[0] : 'ALDO';
        thA.addEventListener('dblclick', (ev) => {
            ev.stopPropagation();
            startEditSubHeader(y, 0, thA);
        });
        tr2.appendChild(thA);

        const thM = document.createElement('th');
        thM.textContent = headerInfo.sub && headerInfo.sub[1] ? headerInfo.sub[1] : 'MARCOS';
        thM.addEventListener('dblclick', (ev) => {
            ev.stopPropagation();
            startEditSubHeader(y, 1, thM);
        });
        tr2.appendChild(thM);
    });
    thead.appendChild(tr2);

    // Build tbody rows (months)
    tbody.innerHTML = '';

    months.forEach(month => {
        const tr = document.createElement('tr');

        const tdMonth = document.createElement('td');
        tdMonth.textContent = month;
        tr.appendChild(tdMonth);

        const tdTotals = document.createElement('td');
        tdTotals.innerHTML = `
            <div><strong>T. BRUT.</strong></div>
            <div><strong>T.LIQ.</strong></div>
            <div><strong>PORC. %</strong></div>
            <div><strong>GAN / PER</strong></div>
        `;
        tr.appendChild(tdTotals);

        // For each year column, create ALDO and MARCOS td structure (editable using manual data)
        yearsToShow.forEach(year => {
            const manual = getManual(year, month);

            const tdA = document.createElement('td');
            // compute total percent for this month/year combining aldo + marcos pct
            const pctA = Number(manual.aldo && manual.aldo.pct) || 0;
            const pctM = Number(manual.marcos && manual.marcos.pct) || 0;
            const totalPctForMonth = pctA + pctM;
            tdA.innerHTML = `
                <div><input class="histor-input" data-year="${year}" data-month="${escapeHtml(month)}" data-person="aldo" data-field="bruto" value="${formatCLP(Number(manual.aldo.bruto) || 0)}" onchange="handleHistoricalInput(event)"></div>
                <div><input class="histor-input" data-year="${year}" data-month="${escapeHtml(month)}" data-person="aldo" data-field="liq" value="${formatCLP(Number(manual.aldo.liq) || 0)}" onchange="handleHistoricalInput(event)"></div>
                <div><input class="histor-input" data-year="${year}" data-month="${escapeHtml(month)}" data-person="aldo" data-field="pct" value="${formatCLP(Number(pctA) || 0)}" onchange="handleHistoricalInput(event)"></div>
                <div style="display:flex;align-items:center;justify-content:center;"><strong>${formatCLP(totalPctForMonth)}</strong></div>
            `;
            tr.appendChild(tdA);

            const tdM = document.createElement('td');
            tdM.innerHTML = `
                <div><input class="histor-input" data-year="${year}" data-month="${escapeHtml(month)}" data-person="marcos" data-field="bruto" value="${formatCLP(Number(manual.marcos.bruto) || 0)}" onchange="handleHistoricalInput(event)"></div>
                <div><input class="histor-input" data-year="${year}" data-month="${escapeHtml(month)}" data-person="marcos" data-field="liq" value="${formatCLP(Number(manual.marcos.liq) || 0)}" onchange="handleHistoricalInput(event)"></div>
                <div><input class="histor-input" data-year="${year}" data-month="${escapeHtml(month)}" data-person="marcos" data-field="pct" value="${formatCLP(Number(pctM) || 0)}" onchange="handleHistoricalInput(event)"></div>
                <div></div>
            `;
            tr.appendChild(tdM);
        });

        tbody.appendChild(tr);
    });

    // Append TOTAL FINAL row: for each year show stacked totals similar to previous single-year implementation
    (function appendTotalFinalRow() {
        const monthsCount = months.length || 12;
        const trFinal = document.createElement('tr');
        trFinal.className = 'total-final-row';

        const tdMonth = document.createElement('td');
        tdMonth.textContent = 'TOTAL FINAL';
        trFinal.appendChild(tdMonth);

        const tdTotalsFinal = document.createElement('td');
        tdTotalsFinal.innerHTML = `
            <div><strong>T. BRUT. AÑO</strong></div>
            <div><strong>T. BRUT. PROM:</strong></div>
            <div><strong>T. LIQ. AÑO</strong></div>
            <div><strong>T. LIQ. PROM.</strong></div>
            <div><strong>PORC. % AÑO</strong></div>
            <div><strong>PORC. % PROM.</strong></div>
            <div><strong>GAN / PER AÑO</strong></div>
            <div><strong>GAN / PER PROM.</strong></div>
        `;
        trFinal.appendChild(tdTotalsFinal);

        yearsToShow.forEach(year => {
            // compute totals for this year from manual data if present; otherwise use computed monthValues
            let brutoAnoA = 0, brutoAnoM = 0;
            let liqAnoA = 0, liqAnoM = 0;
            let sumPctA = 0, sumPctM = 0;
            let monthsWithA = 0, monthsWithM = 0;
            let monthsWithYear = 0; // months that have any record for either person

            months.forEach(m => {
                const mm = (allYearsData._historicalManual[year] && allYearsData._historicalManual[year][m]) || { aldo: { bruto: 0, liq: 0, pct: 0 }, marcos: { bruto: 0, liq: 0, pct: 0 } };

                const aBr = Number(mm.aldo.bruto) || 0;
                const mBr = Number(mm.marcos.bruto) || 0;
                const aLq = Number(mm.aldo.liq) || 0;
                const mLq = Number(mm.marcos.liq) || 0;
                const aPct = Number(mm.aldo.pct) || 0;
                const mPct = Number(mm.marcos.pct) || 0;

                brutoAnoA += aBr;
                brutoAnoM += mBr;
                liqAnoA += aLq;
                liqAnoM += mLq;

                const hasA = (aBr !== 0 || aLq !== 0 || aPct !== 0);
                const hasM = (mBr !== 0 || mLq !== 0 || mPct !== 0);
                if (hasA) monthsWithA++;
                if (hasM) monthsWithM++;
                if (hasA || hasM) monthsWithYear++;

                sumPctA += aPct;
                sumPctM += mPct;
            });

            // If manual totals are all zero AND the year was NOT explicitly created with manual zeros, fallback to computed totals.
            // This ensures newly added year columns that were intentionally initialized to $0 keep $0 values.
            if (brutoAnoA === 0 && brutoAnoM === 0 && !(allYearsData._historicalManual && allYearsData._historicalManual[year] && allYearsData._historicalManual[year].__explicit)) {
                let totalIncome = 0, totalProfit = 0;
                months.forEach(m => {
                    const vals = monthValues(year, m);
                    totalIncome += vals.income;
                    totalProfit += vals.profit;
                });
                brutoAnoA = totalIncome;
                liqAnoA = totalProfit;
                // when falling back to computed totals, derive monthsWithYear from actual stored months
                monthsWithYear = 0;
                months.forEach(m => {
                    const vals = monthValues(year, m);
                    if ((vals.income > 0) || (vals.expenses > 0)) monthsWithYear++;
                });
            }

            // Compute per-person averages using only months that contain data for that person.
            const brutoPromA = monthsWithA > 0 ? brutoAnoA / monthsWithA : 0;
            const brutoPromM = monthsWithM > 0 ? brutoAnoM / monthsWithM : 0;
            const liqPromA = monthsWithA > 0 ? liqAnoA / monthsWithA : 0;
            const liqPromM = monthsWithM > 0 ? liqAnoM / monthsWithM : 0;

            const porcAnoA = sumPctA;
            const porcPromA = monthsWithA > 0 ? (sumPctA / monthsWithA) : 0;
            const porcAnoM = sumPctM;
            const porcPromM = monthsWithM > 0 ? (sumPctM / monthsWithM) : 0;

            const ganPerAno = porcAnoA + porcAnoM;
            // GAN / PER PROM: GAN / PER AÑO dividido por la cantidad de meses que tuvieron registro en ese año
            const ganPerProm = monthsWithYear > 0 ? (ganPerAno / monthsWithYear) : 0;

            const tdA = document.createElement('td');
            tdA.innerHTML = `
                <div>${formatCLP(brutoAnoA)}</div>
                <div>${formatCLP(brutoPromA)}</div>
                <div>${formatCLP(liqAnoA)}</div>
                <div>${formatCLP(liqPromA)}</div>
                <div>${formatCLP(porcAnoA)}</div>
                <div>${formatCLP(porcPromA)}</div>
                <div><strong>${formatCLP(ganPerAno)}</strong></div>
                <div><strong>${formatCLP(Math.round(ganPerProm))}</strong></div>
            `;
            trFinal.appendChild(tdA);

            const tdM = document.createElement('td');
            tdM.innerHTML = `
                <div>${formatCLP(brutoAnoM)}</div>
                <div>${formatCLP(brutoPromM)}</div>
                <div>${formatCLP(liqAnoM)}</div>
                <div>${formatCLP(liqPromM)}</div>
                <div>${formatCLP(porcAnoM)}</div>
                <div>${formatCLP(porcPromM)}</div>
                <div></div>
                <div></div>
            `;
            trFinal.appendChild(tdM);
        });

        tbody.appendChild(trFinal);
    })();

    // Distribute column widths to fit the visible area but reserve viewport sizing to max 5 year-pairs
    try {
        const wrapper = document.querySelector('.historical-table-wrapper');
        const tableEl = document.querySelector('.historical-table');
        if (wrapper && tableEl) {
            // total columns in table = MES + TOTALES + 2 cells per year
            const totalCols = 2 + (yearsToShow.length * 2);
            // for viewport sizing, consider at most 5 years (i.e. 5*2 subcolumns) so older columns stay out of immediate view
            const maxVisibleYears = 5;
            const visibleColsForViewport = 2 + (Math.min(yearsToShow.length, maxVisibleYears) * 2);

            const viewportWidth = wrapper.clientWidth || tableEl.clientWidth || tableEl.offsetWidth || window.innerWidth;
            // compute column width based on visible columns so at most 5 years fit without horizontal scroll
            const colWidth = Math.max(80, Math.floor(viewportWidth / visibleColsForViewport) - 2);

            // set the table total width to accommodate all columns so extra years cause horizontal scroll
            const totalTableWidth = totalCols * colWidth;
            tableEl.style.width = totalTableWidth + 'px';

            // apply width to header cells and body cells consistently
            const headerCells = tableEl.querySelectorAll('thead tr:first-child th, thead tr:nth-child(2) th');
            headerCells.forEach((th, idx) => {
                th.style.width = colWidth + 'px';
                th.style.minWidth = colWidth + 'px';
                th.style.boxSizing = 'border-box';
            });
            const bodyRows = tableEl.querySelectorAll('tbody tr');
            bodyRows.forEach(row => {
                Array.from(row.children).forEach((cell, i) => {
                    if (cell) {
                        cell.style.width = colWidth + 'px';
                        cell.style.minWidth = colWidth + 'px';
                        cell.style.boxSizing = 'border-box';
                    }
                });
            });
        }
    } catch (e) {
        // silently ignore layout adjustments if something unexpected happens
    }
}

/* Start editing a year header inline */
function startEditHeaderYear(year, thElement) {
    const hdr = allYearsData._historicalHeaders[year] || { yearLabel: String(year), sub: ['ALDO', 'MARCOS'] };
    const span = thElement.querySelector('.year-label');
    if (!span) return;
    const current = span.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'header-edit-input';
    input.value = current;
    span.replaceWith(input);
    input.focus();
    input.select();

    function finish(save) {
        const val = save ? input.value.trim() || String(year) : hdr.yearLabel;
        // persist
        if (!allYearsData._historicalHeaders) allYearsData._historicalHeaders = {};
        allYearsData._historicalHeaders[year] = allYearsData._historicalHeaders[year] || { yearLabel: String(year), sub: ['ALDO', 'MARCOS'] };
        allYearsData._historicalHeaders[year].yearLabel = val;
        saveData();
        renderHistoricalSummary();
    }

    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        } else if (e.key === 'Escape') {
            finish(false);
        }
    });
}

/* Start editing a subheader inline; subIndex 0 => ALDO, 1 => MARCOS */
function startEditSubHeader(year, subIndex, thElement) {
    const hdr = allYearsData._historicalHeaders[year] || { yearLabel: String(year), sub: ['ALDO', 'MARCOS'] };
    const current = hdr.sub && hdr.sub[subIndex] ? hdr.sub[subIndex] : (subIndex === 0 ? 'ALDO' : 'MARCOS');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'header-edit-input';
    input.value = current;
    // replace text node content
    while (thElement.firstChild) thElement.removeChild(thElement.firstChild);
    thElement.appendChild(input);
    input.focus();
    input.select();

    function finish(save) {
        const val = save ? input.value.trim() || (subIndex === 0 ? 'ALDO' : 'MARCOS') : current;
        if (!allYearsData._historicalHeaders) allYearsData._historicalHeaders = {};
        allYearsData._historicalHeaders[year] = allYearsData._historicalHeaders[year] || { yearLabel: String(year), sub: ['ALDO', 'MARCOS'] };
        allYearsData._historicalHeaders[year].sub[subIndex] = val;
        saveData();
        renderHistoricalSummary();
    }

    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        } else if (e.key === 'Escape') {
            finish(false);
        }
    });
}

/* Add a new year column to the historical table to the right of existing year columns.
   New year value is the next integer after the current maximum shown year. */
function addHistoricalYearColumn() {
    if (!allYearsData._historicalYears || !Array.isArray(allYearsData._historicalYears)) {
        allYearsData._historicalYears = [2022];
    }
    const yrs = allYearsData._historicalYears;
    const maxYear = yrs.reduce((m, y) => Math.max(m, Number(y)), 0) || yrs[0] || 2022;
    const newYear = maxYear + 1;
    // Insert the new year at the start so the new column appears immediately next to TOTALES
    yrs.unshift(newYear);

    // ensure manual storage placeholder exists and initialize every month with zeros
    if (!allYearsData._historicalManual) allYearsData._historicalManual = {};
    if (!allYearsData._historicalManual[newYear]) allYearsData._historicalManual[newYear] = {};

    const months = getLastTwelveMonths();
    months.forEach(m => {
        allYearsData._historicalManual[newYear][m] = {
            aldo: { bruto: 0, liq: 0, pct: 0 },
            marcos: { bruto: 0, liq: 0, pct: 0 }
        };
    });
    // mark this year's manual data as explicit so the UI treats zeros as intentional (avoid falling back to computed totals)
    allYearsData._historicalManual[newYear].__explicit = true;

    // ensure header placeholders exist for the new year
    if (!allYearsData._historicalHeaders) allYearsData._historicalHeaders = {};
    allYearsData._historicalHeaders[newYear] = { yearLabel: String(newYear), sub: ['ALDO', 'MARCOS'] };

    saveData();
    // re-render table with new column
    try { renderHistoricalSummary(); } catch (e) { /* ignore */ }
}

/* Remove a year column from the historical summary, including manual entries for that year */
function deleteHistoricalYear(year) {
    if (!confirm('Eliminar el año ' + year + ' de la tabla histórica? Esta acción no se puede deshacer.')) return;
    // remove from visible years array
    if (Array.isArray(allYearsData._historicalYears)) {
        allYearsData._historicalYears = allYearsData._historicalYears.filter(y => Number(y) !== Number(year));
    }
    // remove any manual data stored for that year
    if (allYearsData._historicalManual && allYearsData._historicalManual[year]) {
        delete allYearsData._historicalManual[year];
    }
    saveData();
    try { renderHistoricalSummary(); } catch (e) { /* ignore */ }
}

/* Handler for manual edits in historical table */
function handleHistoricalInput(event) {
    const input = event.target;
    const year = Number(input.dataset.year);
    const month = input.dataset.month;
    const person = input.dataset.person; // 'aldo' or 'marcos'
    const field = input.dataset.field; // 'bruto', 'liq', 'pct'
    let raw = input.value || '';

    // Normalize values: pct can be decimal, bruto/liq expect numbers (allow currency-like inputs)
    if (field === 'pct') {
        // Accept currency-formatted input like "$1.234" and convert to integer CLP
        raw = Number(raw.toString().replace(/[^0-9-]/g, '')) || 0;
        raw = Math.round(raw); // ensure integer CLP
    } else {
        // remove non digits for bruto/liq
        raw = Number(raw.toString().replace(/\D/g, '')) || 0;
    }

    if (!allYearsData._historicalManual) allYearsData._historicalManual = {};
    if (!allYearsData._historicalManual[year]) allYearsData._historicalManual[year] = {};
    if (!allYearsData._historicalManual[year][month]) {
        allYearsData._historicalManual[year][month] = {
            aldo: { bruto: 0, liq: 0, pct: 0 },
            marcos: { bruto: 0, liq: 0, pct: 0 }
        };
    }

    allYearsData._historicalManual[year][month][person][field] = raw;
    // persist and re-render footer totals
    saveData();
    // update footer values quickly without full rerender (but simplest: rerender)
    try { renderHistoricalSummary(); } catch (e) { /* ignore */ }
}

/* Helper to produce plain numeric strings for input values (no currency symbol) */
function formatPlainNumber(n) {
    const num = Number(n) || 0;
    return Math.round(num).toLocaleString('es-CL');
}

// format percent display (plain number with %)
function formatPercent(n) {
    if (n === 0) return '0%';
    // show as integer percent (no currency)
    return `${Math.round(n)}%`;
}

function setVariation(elementId, variation) {
    const element = document.getElementById(elementId);
    element.textContent = `${variation.toFixed(1)}%`;
    element.className = variation > 0 ? 'variation-positive' : 'variation-negative';
}

// Función para formatear entrada de moneda
function formatCLPInput(number) {
    return number.toLocaleString('es-CL');
}

// Función para manejar el formato mientras se escribe
function formatCurrencyInput(input) {
    let value = input.value.replace(/\D/g, '');
    if (value === '') return;
    
    input.value = Number(value).toLocaleString('es-CL');
}

// Función para manejar el cambio de valor en inputs de moneda
function handleCurrencyInput(input, index, type) {
    const value = Number(input.value.replace(/\D/g, ''));
    if (type === 'income') {
        updateIncome(index, 'amount', value);
    } else {
        updateExpense(index, 'amount', value);
    }
}

// Función para respaldar datos
function backupData() {
    const data = {
        allYearsData: allYearsData,
        currentMonth: currentMonth,
        selectedYear: selectedYear
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `figaro-backup-all-years.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Función para restaurar datos
function restoreData() {
    document.getElementById('fileInput').click();
}

// Función para manejar la selección de archivo
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            allYearsData = data.allYearsData || {};
            currentMonth = data.currentMonth;
            if (data.selectedYear) {
                selectedYear = data.selectedYear;
                document.getElementById('yearSelector').value = selectedYear;
            }
            
            financialData = allYearsData[selectedYear] || {};
            saveData(); // Guardar los datos restaurados
            init();
            selectMonth(currentMonth);
            
            alert('Datos restaurados exitosamente');
        } catch (error) {
            alert('Error al restaurar los datos');
            console.error(error);
        }
    };
    reader.readAsText(file);
}

// Agregar función para guardar datos
function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allYearsData));
    // refresh historical summary when data changes
    try { renderHistoricalSummary(); } catch (e) { /* ignore */ }
}

// Modificar las funciones que alteran datos para incluir el guardado
function deleteIncome(index) {
    financialData[currentMonth].income.splice(index, 1);
    loadMonthData();
    saveData();
}

function deleteExpense(index) {
    financialData[currentMonth].expenses.splice(index, 1);
    loadMonthData();
    saveData();
}

function initializeYearSelector() {
    const yearSelector = document.getElementById('yearSelector');
    
    // Show years from 2018 to 2070
    for (let year = 2018; year <= 2070; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === selectedYear) {
            option.selected = true;
        }
        yearSelector.appendChild(option);
    }
    
    yearSelector.addEventListener('change', (e) => {
        selectedYear = parseInt(e.target.value);
        if (!allYearsData[selectedYear]) {
            allYearsData[selectedYear] = {};
        }
        financialData = allYearsData[selectedYear];
        init();
    });
}

/* Change the selected year by delta (-1 or +1) */
function changeYear(delta) {
    const yearSelector = document.getElementById('yearSelector');
    let newYear = selectedYear + delta;
    // Clamp to available options (2018-2070)
    newYear = Math.max(2018, Math.min(2070, newYear));
    if (newYear === selectedYear) return;
    selectedYear = newYear;
    yearSelector.value = selectedYear;
    if (!allYearsData[selectedYear]) allYearsData[selectedYear] = {};
    financialData = allYearsData[selectedYear];
    init();
}

function transferToNextMonth() {
    // Get current month index
    const months = getLastTwelveMonths();
    const currentIndex = months.indexOf(currentMonth);
    
    // If we're at the last month, alert and return
    if (currentIndex === months.length - 1) {
        alert('No se puede traspasar desde el último mes del año');
        return;
    }
    
    const nextMonth = months[currentIndex + 1];
    
    // Initialize next month if it doesn't exist
    if (!financialData[nextMonth]) {
        financialData[nextMonth] = {
            income: [],
            expenses: []
        };
    }
    
    // Copy income descriptions
    const currentIncome = financialData[currentMonth].income;
    financialData[nextMonth].income = currentIncome.map(item => ({
        description: item.description,
        amount: 0
    }));
    
    // Copy expense descriptions
    const currentExpenses = financialData[currentMonth].expenses;
    financialData[nextMonth].expenses = currentExpenses.map(item => ({
        description: item.description,
        amount: 0,
        percentage: item.percentage
    }));
    
    // Save and reload
    saveData();
    selectMonth(nextMonth);
}

// Inicializar la aplicación cuando se cargue la página
window.onload = function() {
    initializeYearSelector();
    init();
};