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
   If not present, default to [2022]. This version supports any number of subcolumns per year,
   adds a "+" button at the left of each year header to add a new subcolumn, renders GAN / PER
   under the first subcolumn and the variation under the second subcolumn, and preserves column dividers. */
function renderHistoricalSummary() {
    const months = getLastTwelveMonths();
    const tbody = document.getElementById('historicalBody');
    if (!tbody) return;

    // Ensure helper structures exist
    if (!allYearsData._historicalManual) allYearsData._historicalManual = {};
    if (!allYearsData._historicalHeaders) allYearsData._historicalHeaders = {};
    if (!allYearsData._historicalYears || !Array.isArray(allYearsData._historicalYears) || allYearsData._historicalYears.length === 0) {
        allYearsData._historicalYears = [2022];
    }
    const yearsToShow = allYearsData._historicalYears.slice();

    // Ensure header placeholders exist and default to two subs if missing
    yearsToShow.forEach(y => {
        if (!allYearsData._historicalHeaders[y]) {
            allYearsData._historicalHeaders[y] = { yearLabel: String(y), sub: ['ALDO', 'MARCOS'] };
        } else if (!Array.isArray(allYearsData._historicalHeaders[y].sub) || allYearsData._historicalHeaders[y].sub.length === 0) {
            allYearsData._historicalHeaders[y].sub = ['ALDO', 'MARCOS'];
        }
    });

    // helper: get manual month object for a given year+month
    function getManual(year, month) {
        if (!allYearsData._historicalManual[year]) return {};
        return allYearsData._historicalManual[year][month] || {};
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

    // First header row: MES, TOTALES, then one colspan = number of subs for each year
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
        const headerInfo = allYearsData._historicalHeaders[y];
        const colspan = Math.max(1, (headerInfo.sub && headerInfo.sub.length) || 2);
        const thYear = document.createElement('th');
        thYear.colSpan = colspan;
        // build year header with a left "+" button to add a subcolumn and delete button on the right
        thYear.innerHTML = `<div class="year-header" style="display:flex;align-items:center;justify-content:center;position:relative;">
                                <button class="plus-icon" aria-label="Agregar subcolumna ${String(y)}" onclick="addSubcolumn(${Number(y)})" style="position:absolute;left:6px;top:50%;transform:translateY(-50%);width:26px;height:26px;background:rgba(255,255,255,0.18);">+</button>
                                <span class="year-label">${escapeHtml(headerInfo.yearLabel)}</span>
                                <button class="year-delete-btn" aria-label="Eliminar año ${String(y)}" onclick="deleteHistoricalYear(${Number(y)})">×</button>
                            </div>`;
        // dblclick handler to edit year label
        thYear.addEventListener('dblclick', (ev) => {
            ev.stopPropagation();
            startEditHeaderYear(y, thYear);
        });
        tr1.appendChild(thYear);
    });

    thead.appendChild(tr1);

    // Second header row: render one th per subcolumn (editable)
    const tr2 = document.createElement('tr');
    yearsToShow.forEach(y => {
        const headerInfo = allYearsData._historicalHeaders[y];
        const subs = headerInfo.sub || ['ALDO', 'MARCOS'];
        subs.forEach((subLabel, subIndex) => {
            const thSub = document.createElement('th');
            thSub.textContent = subLabel || `SUB${subIndex+1}`;
            thSub.addEventListener('dblclick', (ev) => {
                ev.stopPropagation();
                startEditSubHeaderDynamic(y, subIndex, thSub);
            });
            // right-click context menu to offer "Eliminar subcolumna"
            thSub.addEventListener('contextmenu', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                showSubcolumnContextMenu(ev, y, subIndex, thSub);
            });
            tr2.appendChild(thSub);
        });
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

        // For each year, create a td for each subcolumn
        yearsToShow.forEach(year => {
            const headerInfo = allYearsData._historicalHeaders[year];
            const subs = headerInfo.sub || ['ALDO', 'MARCOS'];
            const manualMonth = getManual(year, month);

            subs.forEach((subLabel, subIndex) => {
                const personKey = (subLabel || '').toString().toLowerCase().replace(/\s+/g, '_') || `sub${subIndex}`;
                // ensure the manual structure has the key for this month
                if (!allYearsData._historicalManual[year]) allYearsData._historicalManual[year] = {};
                if (!allYearsData._historicalManual[year][month]) allYearsData._historicalManual[year][month] = {};
                if (!allYearsData._historicalManual[year][month][personKey]) {
                    // default structure similar to aldo/marcos
                    allYearsData._historicalManual[year][month][personKey] = { bruto: 0, liq: 0, pct: 0 };
                }
                const manual = allYearsData._historicalManual[year][month][personKey];

                // Prepare the TD content: inputs for bruto, liq, pct
                const td = document.createElement('td');
                // If this is the first subcolumn, show GAN / PER (sum of pct across this month's subs) at bottom
                // If this is the second subcolumn, show variation indicator relative to previous year at bottom
                // Others just show inputs and empty bottom cell
                const pctThis = Number(manual.pct) || 0;

                // Compute GAN / PER (sum of pct across subs for this year/month) only for display under first sub
                let ganPerForMonth = 0;
                if (allYearsData._historicalManual[year] && allYearsData._historicalManual[year][month]) {
                    const mm = allYearsData._historicalManual[year][month];
                    ganPerForMonth = Object.values(mm).reduce((s, obj) => {
                        if (!obj || typeof obj !== 'object') return s;
                        return s + (Number(obj.pct) || 0);
                    }, 0);
                } else {
                    // fallback to computed profit
                    const mv = monthValues(year, month);
                    ganPerForMonth = mv.profit || 0;
                }

                // Variation calculation for the second subcolumn: compare ganPerForMonth vs previous year's same month
                let variationHtml = '&nbsp;';
                if (subIndex === 1) {
                    const prevYearForVar = Number(year) - 1;
                    // compute previous total similar to above
                    let prevTotal = 0;
                    if (allYearsData._historicalManual[prevYearForVar] && allYearsData._historicalManual[prevYearForVar][month]) {
                        const prevMM = allYearsData._historicalManual[prevYearForVar][month];
                        prevTotal = Object.values(prevMM).reduce((s, obj) => s + (Number(obj && obj.pct) || 0), 0);
                    } else {
                        const mv = monthValues(prevYearForVar, month);
                        prevTotal = mv.profit || 0;
                    }
                    const currTotal = ganPerForMonth || 0;
                    let variationPercent = 0;
                    if (prevTotal === 0) variationPercent = currTotal > 0 ? 100 : 0;
                    else variationPercent = ((currTotal - prevTotal) / Math.abs(prevTotal)) * 100;
                    const varClass = variationPercent > 0 ? 'variation-positive' : 'variation-negative';
                    variationHtml = `<strong class="${varClass}">${variationPercent.toFixed(1)}%</strong>`;
                }

                td.innerHTML = `
                    <div><input class="histor-input" data-year="${year}" data-month="${escapeHtml(month)}" data-person="${escapeHtml(personKey)}" data-field="bruto" value="${formatCLP(Number(manual.bruto) || 0)}" onchange="handleHistoricalInput(event)"></div>
                    <div><input class="histor-input" data-year="${year}" data-month="${escapeHtml(month)}" data-person="${escapeHtml(personKey)}" data-field="liq" value="${formatCLP(Number(manual.liq) || 0)}" onchange="handleHistoricalInput(event)"></div>
                    <div><input class="histor-input" data-year="${year}" data-month="${escapeHtml(month)}" data-person="${escapeHtml(personKey)}" data-field="pct" value="${formatCLP(Number(manual.pct) || 0)}" onchange="handleHistoricalInput(event)"></div>
                    <div style="display:flex;align-items:center;justify-content:center;">
                        ${subIndex === 0 ? `<strong>${formatCLP(ganPerForMonth)}</strong>` : variationHtml}
                    </div>
                `;
                tr.appendChild(td);
            });
        });

        tbody.appendChild(tr);
    });

    // Append TOTAL FINAL row: dynamically create one td per subcolumn per year with aggregated values
    (function appendTotalFinalRow() {
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
            const headerInfo = allYearsData._historicalHeaders[year];
            const subs = headerInfo.sub || ['ALDO', 'MARCOS'];

            // Aggregate per subcolumn
            subs.forEach((subLabel, subIndex) => {
                const personKey = (subLabel || '').toString().toLowerCase().replace(/\s+/g, '_') || `sub${subIndex}`;
                let brutoAno = 0, liqAno = 0, sumPct = 0;
                let monthsWithPerson = 0, monthsWithYear = 0;

                months.forEach(m => {
                    const mmAll = (allYearsData._historicalManual[year] && allYearsData._historicalManual[year][m]) || {};
                    const mm = mmAll[personKey] || { bruto: 0, liq: 0, pct: 0 };
                    const br = Number(mm.bruto) || 0;
                    const lq = Number(mm.liq) || 0;
                    const pct = Number(mm.pct) || 0;
                    brutoAno += br;
                    liqAno += lq;
                    sumPct += pct;
                    if (br !== 0 || lq !== 0 || pct !== 0) monthsWithPerson++;
                    // monthsWithYear counts if any person has data
                    const anyHas = Object.values(mmAll).some(x => x && (Number(x.bruto) || Number(x.liq) || Number(x.pct)));
                    if (anyHas) monthsWithYear++;
                });

                // fallback: if all zeros and not explicit, try computed totals across months
                if (brutoAno === 0 && liqAno === 0 && sumPct === 0 && !(allYearsData._historicalManual && allYearsData._historicalManual[year] && allYearsData._historicalManual[year].__explicit)) {
                    let computedBruto = 0, computedProfit = 0, countMonths = 0;
                    months.forEach(m => {
                        const mv = monthValues(year, m);
                        computedBruto += mv.income;
                        computedProfit += mv.profit;
                        if (mv.income > 0 || mv.expenses > 0) countMonths++;
                    });
                    brutoAno = computedBruto;
                    liqAno = computedProfit;
                    monthsWithYear = countMonths;
                }

                const brutoProm = monthsWithPerson > 0 ? brutoAno / monthsWithPerson : 0;
                const liqProm = monthsWithPerson > 0 ? liqAno / monthsWithPerson : 0;
                const porcProm = monthsWithPerson > 0 ? (sumPct / monthsWithPerson) : 0;

                // For first subcolumn, include GAN/PER AÑO and PROM (we compute combined across subs)
                if (subIndex === 0) {
                    // compute ganPerAno across all subs
                    let ganPerAno = 0;
                    let monthsWithYearLocal = 0;
                    months.forEach(m => {
                        const mmAll = (allYearsData._historicalManual[year] && allYearsData._historicalManual[year][m]) || {};
                        const sumThisMonth = Object.values(mmAll).reduce((s, obj) => s + (Number(obj && obj.pct) || 0), 0);
                        if (sumThisMonth !== 0) monthsWithYearLocal++;
                        ganPerAno += sumThisMonth;
                    });
                    if (ganPerAno === 0 && !(allYearsData._historicalManual && allYearsData._historicalManual[year] && allYearsData._historicalManual[year].__explicit)) {
                        // fallback to computed profit totals
                        let totalProfit = 0;
                        let monthsCount = 0;
                        months.forEach(m => {
                            const mv = monthValues(year, m);
                            totalProfit += mv.profit;
                            if (mv.income > 0 || mv.expenses > 0) monthsCount++;
                        });
                        ganPerAno = totalProfit;
                        monthsWithYearLocal = monthsCount;
                    }
                    const ganPerProm = monthsWithYearLocal > 0 ? (ganPerAno / monthsWithYearLocal) : 0;

                    const td = document.createElement('td');
                    td.innerHTML = `
                        <div>${formatCLP(brutoAno)}</div>
                        <div>${formatCLP(brutoProm)}</div>
                        <div>${formatCLP(liqAno)}</div>
                        <div>${formatCLP(liqProm)}</div>
                        <div>${formatCLP(sumPct)}</div>
                        <div>${formatCLP(porcProm)}</div>
                        <div><strong>${formatCLP(ganPerAno)}</strong></div>
                        <div><strong>${formatCLP(Math.round(ganPerProm))}</strong></div>
                    `;
                    trFinal.appendChild(td);
                } else if (subIndex === 1) {
                    // second subcolumn: show variation vs previous year's equivalent metric (we'll compute simple percent variation on combined GAN/PER PROM)
                    const prevYearForTotals = Number(year) - 1;
                    // compute current ganPerProm
                    let currentGanPerProm = 0;
                    let monthsWithYearLocal = 0;
                    // compute current as combined across subs (same as above)
                    let ganPerAnoCurr = 0;
                    months.forEach(m => {
                        const mmAll = (allYearsData._historicalManual[year] && allYearsData._historicalManual[year][m]) || {};
                        const sumThisMonth = Object.values(mmAll).reduce((s, obj) => s + (Number(obj && obj.pct) || 0), 0);
                        if (sumThisMonth !== 0) monthsWithYearLocal++;
                        ganPerAnoCurr += sumThisMonth;
                    });
                    if (ganPerAnoCurr === 0 && !(allYearsData._historicalManual && allYearsData._historicalManual[year] && allYearsData._historicalManual[year].__explicit)) {
                        let totalProfit = 0; let monthsCount = 0;
                        months.forEach(m => {
                            const mv = monthValues(year, m);
                            totalProfit += mv.profit;
                            if (mv.income > 0 || mv.expenses > 0) monthsCount++;
                        });
                        ganPerAnoCurr = totalProfit;
                        monthsWithYearLocal = monthsCount;
                    }
                    currentGanPerProm = monthsWithYearLocal > 0 ? (ganPerAnoCurr / monthsWithYearLocal) : 0;

                    // compute previous
                    let prevGanPerProm = 0;
                    let prevMonthsCount = 0;
                    let prevGanPerAno = 0;
                    months.forEach(m => {
                        const mmAll = (allYearsData._historicalManual[prevYearForTotals] && allYearsData._historicalManual[prevYearForTotals][m]) || {};
                        const sumThisMonth = Object.values(mmAll).reduce((s, obj) => s + (Number(obj && obj.pct) || 0), 0);
                        if (sumThisMonth !== 0) prevMonthsCount++;
                        prevGanPerAno += sumThisMonth;
                    });
                    if (prevGanPerAno === 0 && !(allYearsData._historicalManual && allYearsData._historicalManual[prevYearForTotals] && allYearsData._historicalManual[prevYearForTotals].__explicit)) {
                        let totalProfit = 0; let monthsCount = 0;
                        months.forEach(m => {
                            const mv = monthValues(prevYearForTotals, m);
                            totalProfit += mv.profit;
                            if (mv.income > 0 || mv.expenses > 0) monthsCount++;
                        });
                        prevGanPerAno = totalProfit;
                        prevMonthsCount = monthsCount;
                    }
                    prevGanPerProm = prevMonthsCount > 0 ? (prevGanPerAno / prevMonthsCount) : 0;

                    const variationForGanPerProm = calculateVariationPercentage(Math.round(currentGanPerProm), Math.round(prevGanPerProm));
                    const varClassFinal = variationForGanPerProm > 0 ? 'variation-positive' : 'variation-negative';

                    const td = document.createElement('td');
                    td.innerHTML = `
                        <div>${formatCLP(brutoAno)}</div>
                        <div>${formatCLP(brutoProm)}</div>
                        <div>${formatCLP(liqAno)}</div>
                        <div>${formatCLP(liqProm)}</div>
                        <div>${formatCLP(sumPct)}</div>
                        <div>${formatCLP(porcProm)}</div>
                        <div><strong>&nbsp;</strong></div>
                        <div><strong class="${varClassFinal}">${variationForGanPerProm.toFixed(1)}%</strong></div>
                    `;
                    trFinal.appendChild(td);
                } else {
                    // other subcolumns: show aggregated numbers for that sub
                    const td = document.createElement('td');
                    td.innerHTML = `
                        <div>${formatCLP(brutoAno)}</div>
                        <div>${formatCLP(brutoProm)}</div>
                        <div>${formatCLP(liqAno)}</div>
                        <div>${formatCLP(liqProm)}</div>
                        <div>${formatCLP(sumPct)}</div>
                        <div>${formatCLP(porcProm)}</div>
                        <div><strong>&nbsp;</strong></div>
                        <div><strong>&nbsp;</strong></div>
                    `;
                    trFinal.appendChild(td);
                }
            });
        });

        tbody.appendChild(trFinal);
    })();

    // Layout adjustments: compute total columns based on actual subs per year
    try {
        const wrapper = document.querySelector('.historical-table-wrapper');
        const tableEl = document.querySelector('.historical-table');
        if (wrapper && tableEl) {
            // total columns in table = MES + TOTALES + sum(subs per year)
            let totalSubCols = 0;
            yearsToShow.forEach(y => { totalSubCols += (allYearsData._historicalHeaders[y].sub || []).length; });
            const totalCols = 2 + totalSubCols;
            const maxVisibleYears = 5;
            // approximate visible columns: MES + TOTALES + up to maxVisibleYears*2 subs (use 2 subs per visible year for viewport basis)
            const visibleColsForViewport = 2 + Math.min(totalSubCols, maxVisibleYears * 2);

            const viewportWidth = wrapper.clientWidth || tableEl.clientWidth || tableEl.offsetWidth || window.innerWidth;
            const colWidth = Math.max(80, Math.floor(viewportWidth / Math.max(visibleColsForViewport, 1)) - 2);

            const totalTableWidth = totalCols * colWidth;
            tableEl.style.width = totalTableWidth + 'px';

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
        // ignore
    }

    // Ensure a strong vertical divider is placed at the end of each year's group of subcolumns.
    // This computes column indices for each year's last sub and applies a thicker right border
    // to the corresponding THEAD TH and every TBODY TD in that column.
    try {
        const tableEl = document.querySelector('.historical-table');
        if (tableEl) {
            // Set a subtle light border for all cells' right edge to match subcolumn separators,
            // then override the true year-group boundaries with a stronger red border.
            Array.from(tableEl.querySelectorAll('th, td')).forEach(cell => {
                cell.style.borderRight = '1px solid #e0e0e0';
            });

            // ALSO ensure MES (col index 0) and TOTALES (col index 1) show the stronger year-divider style
            // Apply to THEAD (only first header row to avoid adding borders between subheaders)
            const theadRows = tableEl.querySelectorAll('thead tr');
            const firstHead = theadRows[0];
            if (firstHead) {
                const thMes = firstHead.children[0];
                const thTotals = firstHead.children[1];
                if (thMes) thMes.style.setProperty('border-right', '3px solid #c41e3a', 'important');
                if (thTotals) thTotals.style.setProperty('border-right', '3px solid #c41e3a', 'important');
            }
            // Apply to TBODY rows
            const bodyRowsAll = tableEl.querySelectorAll('tbody tr');
            bodyRowsAll.forEach(tr => {
                const tdMes = tr.children[0];
                const tdTotals = tr.children[1];
                if (tdMes) tdMes.style.setProperty('border-right', '3px solid #c41e3a', 'important');
                if (tdTotals) tdTotals.style.setProperty('border-right', '3px solid #c41e3a', 'important');
            });
            // Also apply to TFOOT if present
            const tfootRowsAll = tableEl.querySelectorAll('tfoot tr');
            tfootRowsAll.forEach(tr => {
                const tfMes = tr.children[0];
                const tfTotals = tr.children[1];
                if (tfMes) tfMes.style.setProperty('border-right', '3px solid #c41e3a', 'important');
                if (tfTotals) tfTotals.style.setProperty('border-right', '3px solid #c41e3a', 'important');
            });

            // compute starting offset: table columns ordering is MES (1), TOTALES (2), then subs...
            let colOffset = 2; // zero-based index for children in rows: 0=MES,1=TOTALES, so first sub is index 2
            yearsToShow.forEach(year => {
                const headerInfo = allYearsData._historicalHeaders[year] || { sub: ['ALDO', 'MARCOS'] };
                const subsCount = Math.max(1, (headerInfo.sub && headerInfo.sub.length) || 2);

                // index (zero-based) of the last subcolumn for this year
                const lastColIndex = colOffset + (subsCount - 1);

                // Apply stronger right border to the FIRST header row cell that corresponds to this logical last column.
                const firstHeadRow = theadRows[0];
                if (firstHeadRow) {
                    const th = firstHeadRow.children[lastColIndex];
                    if (th) {
                        th.style.setProperty('border-right', '3px solid #c41e3a', 'important');
                    }
                }

                // Also apply the same strong red divider to the corresponding subheader TH
                // in the second header row (the subcolumns row). The subheader index maps to
                // overall column index minus the two fixed columns (MES + TOTALES).
                const secondHeadRow = theadRows[1];
                if (secondHeadRow) {
                    const subHeaderIndex = lastColIndex - 2; // translate overall index to second-row index
                    const thSub = secondHeadRow.children[subHeaderIndex];
                    if (thSub) {
                        thSub.style.setProperty('border-right', '3px solid #c41e3a', 'important');
                    }
                }

                // Apply stronger right border to each tbody row cell at this index
                const bodyRows = tableEl.querySelectorAll('tbody tr');
                bodyRows.forEach(tr => {
                    const td = tr.children[lastColIndex];
                    if (td) {
                        td.style.setProperty('border-right', '3px solid #c41e3a', 'important');
                    }
                });

                // Apply stronger right border to each tfoot row cell at this index (if any)
                const footRows = tableEl.querySelectorAll('tfoot tr');
                footRows.forEach(tr => {
                    const tf = tr.children[lastColIndex];
                    if (tf) {
                        tf.style.setProperty('border-right', '3px solid #c41e3a', 'important');
                    }
                });

                // advance offset by number of subs for next year
                colOffset += subsCount;
            });
        }
    } catch (err) {
        // ignore silently
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

/* Start editing a subheader inline for dynamic subcolumns */
function startEditSubHeaderDynamic(year, subIndex, thElement) {
    const hdr = allYearsData._historicalHeaders[year] || { yearLabel: String(year), sub: ['ALDO', 'MARCOS'] };
    const current = hdr.sub && hdr.sub[subIndex] ? hdr.sub[subIndex] : `SUB${subIndex+1}`;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'header-edit-input';
    input.value = current;
    while (thElement.firstChild) thElement.removeChild(thElement.firstChild);
    thElement.appendChild(input);
    input.focus();
    input.select();

    function finish(save) {
        const val = save ? input.value.trim() || current : current;
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

    // Determine new year number: one greater than current maximum
    const maxYear = yrs.reduce((m, y) => Math.max(m, Number(y)), 0) || yrs[0] || 2022;
    const newYear = maxYear + 1;

    // Determine template subcolumns: copy from the currently first visible year (the one immediately right of TOTALES)
    let templateSubs = ['ALDO', 'MARCOS'];
    if (Array.isArray(yrs) && yrs.length > 0) {
        const firstVisible = yrs[0];
        if (allYearsData._historicalHeaders && allYearsData._historicalHeaders[firstVisible] && Array.isArray(allYearsData._historicalHeaders[firstVisible].sub) && allYearsData._historicalHeaders[firstVisible].sub.length > 0) {
            // clone the array so subsequent edits don't mutate the source
            templateSubs = allYearsData._historicalHeaders[firstVisible].sub.slice();
        }
    }

    // Insert the new year at the start so the new column appears immediately next to TOTALES
    yrs.unshift(newYear);

    // ensure manual storage placeholder exists and initialize every month with zeros for each template subcolumn
    if (!allYearsData._historicalManual) allYearsData._historicalManual = {};
    if (!allYearsData._historicalManual[newYear]) allYearsData._historicalManual[newYear] = {};
    const months = getLastTwelveMonths();
    months.forEach(m => {
        allYearsData._historicalManual[newYear][m] = {};
        templateSubs.forEach(subLabel => {
            const personKey = subLabel.toString().toLowerCase().replace(/\s+/g, '_');
            allYearsData._historicalManual[newYear][m][personKey] = { bruto: 0, liq: 0, pct: 0 };
        });
    });
    // mark this year's manual data as explicit so the UI treats zeros as intentional (avoid falling back to computed totals)
    allYearsData._historicalManual[newYear].__explicit = true;

    // ensure header placeholders exist for the new year and copy the template sublabels
    if (!allYearsData._historicalHeaders) allYearsData._historicalHeaders = {};
    allYearsData._historicalHeaders[newYear] = { yearLabel: String(newYear), sub: templateSubs.slice() };

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
    // remove header info for that year
    if (allYearsData._historicalHeaders && allYearsData._historicalHeaders[year]) {
        delete allYearsData._historicalHeaders[year];
    }
    saveData();
    try { renderHistoricalSummary(); } catch (e) { /* ignore */ }
}

/* Handler for manual edits in historical table (supports dynamic person keys) */
function handleHistoricalInput(event) {
    const input = event.target;
    const year = Number(input.dataset.year);
    const month = input.dataset.month;
    const person = input.dataset.person; // dynamic key
    const field = input.dataset.field; // 'bruto', 'liq', 'pct'
    let raw = input.value || '';

    // Normalize values: pct can be decimal, bruto/liq expect numbers (allow currency-like inputs)
    if (field === 'pct') {
        raw = Number(raw.toString().replace(/[^0-9-]/g, '')) || 0;
        raw = Math.round(raw);
    } else {
        raw = Number(raw.toString().replace(/\D/g, '')) || 0;
    }

    if (!allYearsData._historicalManual) allYearsData._historicalManual = {};
    if (!allYearsData._historicalManual[year]) allYearsData._historicalManual[year] = {};
    if (!allYearsData._historicalManual[year][month]) {
        allYearsData._historicalManual[year][month] = {};
    }
    if (!allYearsData._historicalManual[year][month][person]) {
        allYearsData._historicalManual[year][month][person] = { bruto: 0, liq: 0, pct: 0 };
    }

    allYearsData._historicalManual[year][month][person][field] = raw;
    saveData();
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

/* Open the large blank modal for "DATOS AÑO" and render the chart */
let datosAnoChart = null;
async function openDatosAno() {
    const modal = document.getElementById('datosAnoModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'false');

    // get toolbar and canvas wrapper
    const blank = modal.querySelector('.modal-blank-area');
    if (!blank) return;
    const toolbar = blank.querySelector('.chart-toolbar');
    const canvasWrapper = blank.querySelector('.chart-canvas-wrapper');

    // ensure canvas exists
    let canvas = canvasWrapper.querySelector('canvas#datosAnoCanvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'datosAnoCanvas';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvasWrapper.innerHTML = ''; // clear
        canvasWrapper.appendChild(canvas);
    }

    // lazy-import Chart.js from esm.sh
    try {
        const { Chart, registerables } = await import('https://esm.sh/chart.js@4.4.0');
        const ChartDataLabels = (await import('https://esm.sh/chartjs-plugin-datalabels@2.2.0')).default;
        Chart.register(...registerables);
        Chart.register(ChartDataLabels);

        // prepare base data
        const baseData = getChartDataFromHistorical();

        // destroy previous chart
        if (datosAnoChart) {
            datosAnoChart.destroy();
            datosAnoChart = null;
        }

        // create chart with full data (labels = years)
        datosAnoChart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: baseData.years,
                datasets: [
                    {
                        id: 'ganPerProm',
                        label: 'GAN / PER PROM.',
                        data: baseData.ganPerProm,
                        borderColor: '#c41e3a',
                        backgroundColor: 'rgba(196,30,58,0.08)',
                        tension: 0.25,
                        yAxisID: 'y'
                    },
                    {
                        id: 'porcPromA',
                        label: 'PORC. % PROM. ALDO',
                        data: baseData.porcPromA,
                        borderColor: '#1976d2',
                        backgroundColor: 'rgba(25,118,210,0.06)',
                        tension: 0.25,
                        yAxisID: 'y'
                    },
                    {
                        id: 'porcPromM',
                        label: 'PORC. % PROM. MARCOS',
                        data: baseData.porcPromM,
                        borderColor: '#2e7d32',
                        backgroundColor: 'rgba(46,125,50,0.06)',
                        tension: 0.25,
                        yAxisID: 'y'
                    },
                    {
                        id: 'tLiqPromM',
                        label: 'T. LIQ. PROM. MARCOS',
                        data: baseData.tLiqPromM,
                        borderColor: '#ff9800',
                        backgroundColor: 'rgba(255,152,0,0.06)',
                        tension: 0.25,
                        yAxisID: 'y'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                stacked: false,
                layout: {
                    padding: { left: 36, right: 36, top: 12, bottom: 12 }
                },
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const val = context.raw || 0;
                                return context.dataset.label + ': ' + new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP', maximumFractionDigits:0 }).format(val);
                            }
                        }
                    },
                    datalabels: {
                        display: true,
                        align: 'top',
                        anchor: 'end',
                        color: '#333',
                        font: { weight: '700', size: 11 },
                        formatter: function(value) {
                            return new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP', maximumFractionDigits:0 }).format(value);
                        }
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        title: { display: true, text: 'CLP', font: { weight: '700' } },
                        ticks: {
                            callback: function(value) {
                                return new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP', maximumFractionDigits:0 }).format(value);
                            },
                            font: { weight: '700' }
                        }
                    },
                    x: {
                        display: true,
                        title: { display: true, text: 'Años', font: { weight: '700' } },
                        offset: true,
                        ticks: { padding: 8, font: { weight: '700' } }
                    }
                }
            }
        });

        // build compact toolbar: a chip for each year to toggle its visibility in the chart
        function rebuildToolbar(selectedYearsSet) {
            toolbar.innerHTML = '';
            // keep ascending chronological order
            const years = baseData.years.slice();
            years.forEach((y, idx) => {
                const chip = document.createElement('label');
                chip.className = 'year-chip';
                chip.title = `Mostrar datos para ${y}`;
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.checked = selectedYearsSet.has(y);
                cb.dataset.year = y;
                cb.dataset.index = idx;
                cb.addEventListener('change', onYearToggle);
                chip.appendChild(cb);
                const span = document.createElement('span');
                span.textContent = y;
                chip.appendChild(span);
                toolbar.appendChild(chip);
            });
        }

        // initial selected years: all
        const selectedYears = new Set(baseData.years.map(String));
        // if toolbar exists but empty, create it
        if (toolbar) rebuildToolbar(selectedYears);

        // when a year checkbox toggles, filter labels and dataset points to only show selected years
        function onYearToggle() {
            const checkedYears = Array.from(toolbar.querySelectorAll('input[type="checkbox"]:checked')).map(i => i.dataset.year);
            // produce filtered labels and index mapping
            const allLabels = baseData.years;
            const filteredLabels = allLabels.filter(l => checkedYears.includes(l));
            // mapping from original index -> new index; gather dataset values for checked years
            function filterDatasetValues(originalArray) {
                return allLabels.map((lab, i) => ({ lab, val: originalArray[i] }))
                                .filter(obj => checkedYears.includes(obj.lab))
                                .map(obj => obj.val);
            }
            // update chart data
            datosAnoChart.data.labels = filteredLabels;
            datosAnoChart.data.datasets.forEach(ds => {
                if (ds.id === 'ganPerProm') ds.data = filterDatasetValues(baseData.ganPerProm);
                if (ds.id === 'porcPromA') ds.data = filterDatasetValues(baseData.porcPromA);
                if (ds.id === 'porcPromM') ds.data = filterDatasetValues(baseData.porcPromM);
                if (ds.id === 'tLiqPromM') ds.data = filterDatasetValues(baseData.tLiqPromM);
            });
            datosAnoChart.update();
        }

        // ensure toolbar always exists (in case DOM changed)
        if (!toolbar) {
            const newToolbar = document.createElement('div');
            newToolbar.className = 'chart-toolbar';
            blank.insertBefore(newToolbar, canvasWrapper);
            rebuildToolbar(selectedYears);
        }

    } catch (err) {
        console.error('Error loading Chart.js or rendering chart', err);
    }

    // trap focus minimally by focusing close button
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) closeBtn.focus();
}

/* Close the DATOS AÑO modal */
function closeDatosAno() {
    const modal = document.getElementById('datosAnoModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    // destroy chart instance to free memory
    try {
        if (datosAnoChart) {
            datosAnoChart.destroy();
            datosAnoChart = null;
        }
    } catch (e) { /* ignore */ }
}

/* DATOS MENSUAL chart instance */
let datosMensualChart = null;

/* Open the DATOS MENSUAL modal and render a monthly chart for a selected year */
async function openDatosMensual() {
    const modal = document.getElementById('datosMensualModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'false');

    const blank = modal.querySelector('.modal-blank-area');
    if (!blank) return;
    const canvasWrapper = blank.querySelector('.chart-canvas-wrapper');
    const yearSelect = document.getElementById('mensualYearSelect');
    const variableContainer = document.getElementById('variableSelector');
    const multiYearToolbar = document.getElementById('multiYearToolbar');

    // ensure canvas exists
    let canvas = canvasWrapper.querySelector('canvas#datosMensualCanvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'datosMensualCanvas';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvasWrapper.innerHTML = '';
        canvasWrapper.appendChild(canvas);
    }

    // populate year selector from historical years (fallback to selectedYear)
    const yearsList = Array.isArray(allYearsData._historicalYears) && allYearsData._historicalYears.length > 0
        ? allYearsData._historicalYears.slice().map(Number).sort((a,b)=>a-b)
        : [selectedYear];
    // remove duplicates and ensure numeric
    const uniqueYears = [...new Set(yearsList)];
    yearSelect.innerHTML = '';
    uniqueYears.forEach(y => {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        yearSelect.appendChild(opt);
    });
    // default to currently selected year if present
    if (uniqueYears.includes(selectedYear)) yearSelect.value = selectedYear;
    else yearSelect.value = uniqueYears[0];

    // build variable selector (four options)
    const variables = [
        { id: 'ganPer', label: 'GAN / PER', color: '#c41e3a' },
        { id: 'porcA', label: 'PORC % ALDO', color: '#1976d2' },
        { id: 'porcM', label: 'PORC % MARCOS', color: '#2e7d32' },
        { id: 'tLiqM', label: 'T. LIQ. MARCOS', color: '#ff9800' }
    ];
    variableContainer.innerHTML = '';
    variables.forEach(v => {
        const label = document.createElement('label');
        label.style.display = 'inline-flex';
        label.style.alignItems = 'center';
        label.style.gap = '6px';
        label.style.background = '#fff';
        label.style.border = '1px solid #ffdede';
        label.style.padding = '6px 8px';
        label.style.borderRadius = '16px';
        label.style.cursor = 'pointer';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = v.id;
        cb.checked = true; // default show all
        cb.dataset.varId = v.id;
        cb.addEventListener('change', onVariableChange);
        const span = document.createElement('span');
        span.textContent = v.label;
        span.style.color = v.color;
        span.style.fontWeight = '700';
        label.appendChild(cb);
        label.appendChild(span);
        variableContainer.appendChild(label);
    });

    // build multi-year toolbar checkboxes (for single-variable multi-year comparison)
    function rebuildMultiYearToolbar() {
        multiYearToolbar.innerHTML = '';
        uniqueYears.forEach(y => {
            const chip = document.createElement('label');
            chip.className = 'year-chip';
            chip.style.padding = '4px 8px';
            chip.style.borderRadius = '12px';
            chip.style.display = 'inline-flex';
            chip.style.alignItems = 'center';
            chip.style.gap = '6px';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = String(y);
            cb.checked = (String(y) === String(yearSelect.value)); // default select the year shown
            cb.addEventListener('change', onMultiYearChange);
            chip.appendChild(cb);
            const span = document.createElement('span');
            span.textContent = String(y);
            span.style.color = '#c41e3a';
            chip.appendChild(span);
            multiYearToolbar.appendChild(chip);
        });
    }

    // Helper to read selected variables
    function getSelectedVariables() {
        return Array.from(variableContainer.querySelectorAll('input[type="checkbox"]:checked')).map(i => i.value);
    }

    // When chart needs to show a single variable across multiple years
    function buildSingleVariableMultiYearChart(varId, checkedYears) {
        // each checkedYear becomes one dataset; give each year a distinct color
        const months = getLastTwelveMonths();
        const datasets = [];
        // Palette of distinct colors to cycle through
        const palette = ['#c41e3a', '#1976d2', '#2e7d32', '#ff9800', '#8e24aa', '#00796b', '#f57c00', '#512da8', '#d32f2f', '#388e3c'];
        checkedYears.forEach((y, idx) => {
            const d = getMonthlyChartData(Number(y));
            let dataArr = [];
            let label = '';
            if (varId === 'ganPer') { dataArr = d.ganPer; label = `GAN / PER ${y}`; }
            if (varId === 'porcA') { dataArr = d.porcA; label = `PORC % ALDO ${y}`; }
            if (varId === 'porcM') { dataArr = d.porcM; label = `PORC % MARCOS ${y}`; }
            if (varId === 'tLiqM') { dataArr = d.tLiqM; label = `T. LIQ. MARCOS ${y}`; }
            const color = palette[idx % palette.length];
            // create a subtle semi-transparent fill for the area and set point colors
            const bg = colorToRgba(color, 0.12);
            datasets.push({
                id: `${varId}_${y}`,
                label,
                data: dataArr,
                borderColor: color,
                backgroundColor: bg,
                pointBackgroundColor: color,
                pointBorderColor: '#fff',
                tension: 0.25,
                fill: false
            });
        });
        // update chart
        datosMensualChart.data.labels = months;
        datosMensualChart.data.datasets = datasets;
        // keep legend hidden so the chart does not show variable labels
        datosMensualChart.options.plugins.legend.display = false;
        datosMensualChart.update();
    }

    // When chart shows multiple variables for a single year (default behavior)
    function buildMultiVariableSingleYearChart(year) {
        const base = getMonthlyChartData(Number(year));
        const months = base.months;
        const datasets = [
            { id: 'ganPer', label: 'GAN / PER', data: base.ganPer, borderColor: '#c41e3a', tension: 0.25 },
            { id: 'porcA', label: 'PORC. % ALDO', data: base.porcA, borderColor: '#1976d2', tension: 0.25 },
            { id: 'porcM', label: 'PORC. % MARCOS', data: base.porcM, borderColor: '#2e7d32', tension: 0.25 },
            { id: 'tLiqM', label: 'T. LIQ. MARCOS', data: base.tLiqM, borderColor: '#ff9800', tension: 0.25 }
        ];
        datosMensualChart.data.labels = months;
        datosMensualChart.data.datasets = datasets.filter(ds => getSelectedVariables().includes(ds.id));
        // ensure legend remains hidden (variables controlled only from the top panel)
        datosMensualChart.options.plugins.legend.display = false;
        datosMensualChart.update();
    }

    // variable checkbox change handler
    function onVariableChange() {
        const selected = getSelectedVariables();
        if (selected.length === 1) {
            // show multi-year toolbar
            rebuildMultiYearToolbar();
            multiYearToolbar.style.display = 'flex';
            // by default ensure the currently selected year is checked
            const checkedYears = Array.from(multiYearToolbar.querySelectorAll('input[type="checkbox"]:checked')).map(i => i.value);
            // if none checked, check the currently selected year
            if (checkedYears.length === 0) {
                const cb = multiYearToolbar.querySelector(`input[value="${String(yearSelect.value)}"]`);
                if (cb) cb.checked = true;
            }
            const yearsToUse = Array.from(multiYearToolbar.querySelectorAll('input[type="checkbox"]:checked')).map(i => i.value);
            buildSingleVariableMultiYearChart(selected[0], yearsToUse.length ? yearsToUse : [String(yearSelect.value)]);
        } else {
            // hide multi-year toolbar and return to single-year multi-variable view
            multiYearToolbar.style.display = 'none';
            buildMultiVariableSingleYearChart(Number(yearSelect.value));
        }
    }

    // multi-year toolbar change handler
    function onMultiYearChange() {
        const selVars = getSelectedVariables();
        if (selVars.length !== 1) return;
        const checkedYears = Array.from(multiYearToolbar.querySelectorAll('input[type="checkbox"]:checked')).map(i => i.value);
        if (checkedYears.length === 0) {
            // keep at least one year checked — revert the change
            this.checked = true;
            return;
        }
        buildSingleVariableMultiYearChart(selVars[0], checkedYears);
    }

    try {
        const { Chart, registerables } = await import('https://esm.sh/chart.js@4.4.0');
        const ChartDataLabels = (await import('https://esm.sh/chartjs-plugin-datalabels@2.2.0')).default;
        Chart.register(...registerables);
        Chart.register(ChartDataLabels);

        // destroy previous
        if (datosMensualChart) {
            datosMensualChart.destroy();
            datosMensualChart = null;
        }

        // initial empty chart instance (will populate datasets below)
        const initialYear = Number(yearSelect.value);
        const initialBase = getMonthlyChartData(initialYear);

        // local plugin to draw year labels at the end of each dataset line (used for single-variable multi-year view)
        const endLabelPlugin = {
            id: 'endLabelPlugin',
            afterDatasetsDraw(chart, args, options) {
                const { ctx, chartArea: area, scales } = chart;
                if (!chart.data || !chart.data.datasets) return;
                const datasets = chart.data.datasets;
                // only draw when datasets represent separate years (ids like "varId_YYYY")
                ctx.save();
                ctx.font = (options && options.font) ? options.font : '700 12px Arial';
                ctx.fillStyle = (options && options.color) ? options.color : '#c41e3a';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                datasets.forEach(ds => {
                    if (!ds.data || ds.data.length === 0) return;
                    // expect id format like "varId_YYYY"
                    const parts = (ds.id || '').toString().split('_');
                    if (parts.length < 2) return;
                    const yearLabel = parts.slice(1).join('_');
                    // find last non-null point index
                    let lastIdx = ds.data.length - 1;
                    while (lastIdx >= 0 && (ds.data[lastIdx] === null || typeof ds.data[lastIdx] === 'undefined')) lastIdx--;
                    if (lastIdx < 0) return;
                    // get meta to compute pixel position for that data index
                    const meta = chart.getDatasetMeta(chart.data.datasets.indexOf(ds));
                    if (!meta || !meta.data || !meta.data[lastIdx]) return;
                    const point = meta.data[lastIdx];
                    const x = point.x + 8; // small offset to the right
                    const y = point.y;
                    // clip so labels remain inside chart area horizontally
                    const maxX = area.right - 4;
                    const drawX = Math.min(x, maxX - 30);
                    ctx.fillStyle = ds.borderColor || '#c41e3a';
                    ctx.fillText(String(yearLabel), drawX, y);
                });
                ctx.restore();
            }
        };

        datosMensualChart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: initialBase.months,
                datasets: []
            },
            plugins: [endLabelPlugin],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                layout: { padding: { left: 40, right: 40, top: 8, bottom: 8 } },
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const val = context.raw || 0;
                                return context.dataset.label + ': ' + new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP', maximumFractionDigits:0 }).format(val);
                            }
                        }
                    },
                    datalabels: {
                        display: true,
                        align: 'top',
                        anchor: 'end',
                        color: '#333',
                        font: { weight: '700', size: 11 },
                        formatter: function(value) {
                            return new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP', maximumFractionDigits:0 }).format(value);
                        }
                    },
                    // configuration for the endLabelPlugin (font and color)
                    endLabelPlugin: {
                        font: '700 12px Arial',
                        color: '#6b6b6b'
                    }
                },
                scales: {
                    y: {
                        display: true,
                        title: { display: true, text: 'CLP', font: { weight: '700' } },
                        ticks: {
                            callback: function(value) {
                                return new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP', maximumFractionDigits:0 }).format(value);
                            },
                            font: { weight: '700' }
                        }
                    },
                    x: {
                        display: true,
                        title: { display: true, text: 'Meses', font: { weight: '700' } },
                        offset: true,
                        ticks: { font: { weight: '700' }, padding: 18 },
                        grid: { drawBorder: true }
                    }
                }
            }
        });

        // initially render with all variables for the selected year
        buildMultiVariableSingleYearChart(initialYear);

        // update chart when year selection changes
        yearSelect.onchange = function() {
            const y = Number(this.value);
            const selectedVars = getSelectedVariables();
            if (selectedVars.length === 1) {
                // if multi-year toolbar visible, ensure its checkboxes reflect the selected year defaults
                const cb = multiYearToolbar.querySelector(`input[value="${String(y)}"]`);
                if (cb) {
                    // if none selected, check this one
                    const anyChecked = Array.from(multiYearToolbar.querySelectorAll('input[type="checkbox"]:checked')).length > 0;
                    if (!anyChecked) cb.checked = true;
                }
                const yearsToUse = Array.from(multiYearToolbar.querySelectorAll('input[type="checkbox"]:checked')).map(i => i.value);
                buildSingleVariableMultiYearChart(selectedVars[0], yearsToUse.length ? yearsToUse : [String(y)]);
            } else {
                buildMultiVariableSingleYearChart(y);
            }
        };

    } catch (err) {
        console.error('Error loading Chart.js for mensual chart', err);
    }

    // focus close button
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) closeBtn.focus();
}

/* Close the DATOS MENSUAL modal and destroy chart instance */
function closeDatosMensual() {
    const modal = document.getElementById('datosMensualModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    try {
        if (datosMensualChart) {
            datosMensualChart.destroy();
            datosMensualChart = null;
        }
    } catch (e) { /* ignore */ }
}

/* Build monthly chart data for a single year: months labels and four series (GAN/PER, PORC ALDO, PORC MARCOS, T.LIQ MARCOS) */
function getMonthlyChartData(year) {
    const months = getLastTwelveMonths(); // returns month names in Spanish
    const ganPer = [];
    const porcA = [];
    const porcM = [];
    const tLiqM = [];

    months.forEach(month => {
        // prefer manual historical entries if present
        const manualYear = allYearsData._historicalManual && allYearsData._historicalManual[year];
        const manual = manualYear && manualYear[month] ? manualYear[month] : null;

        if (manual) {
            const aPct = Number(manual.aldo.pct) || 0;
            const mPct = Number(manual.marcos.pct) || 0;
            const mLiq = Number(manual.marcos.liq) || 0;
            const gan = aPct + mPct;
            ganPer.push(Math.round(gan));
            porcA.push(Math.round(aPct));
            porcM.push(Math.round(mPct));
            tLiqM.push(Math.round(mLiq));
        } else {
            // fallback: use computed values from stored financial years
            const mv = (function() {
                const ydata = allYearsData[year];
                if (!ydata || !ydata[month]) return { income:0, expenses:0, profit:0 };
                const m = ydata[month];
                const income = Array.isArray(m.income) ? m.income.reduce((s,i)=>s+(Number(i.amount)||0),0) : 0;
                const expenses = Array.isArray(m.expenses) ? m.expenses.reduce((s,i)=>s+(Number(i.amount)||0),0) : 0;
                const profit = income - expenses;
                return { income, expenses, profit };
            })();
            // Use profit as GAN/PER fallback, and zeros for pct/tliq where unavailable
            ganPer.push(Math.round(mv.profit || 0));
            porcA.push(0);
            porcM.push(0);
            tLiqM.push(0);
        }
    });

    return { months, ganPer, porcA, porcM, tLiqM };
}

/* Utility: convert hex color to rgba string with given alpha */
function colorToRgba(hex, alpha) {
    // hex like '#rrggbb'
    if (!hex || hex[0] !== '#' || (hex.length !== 7 && hex.length !== 4)) return `rgba(0,0,0,${alpha})`;
    let r, g, b;
    if (hex.length === 7) {
        r = parseInt(hex.slice(1,3),16);
        g = parseInt(hex.slice(3,5),16);
        b = parseInt(hex.slice(5,7),16);
    } else {
        r = parseInt(hex[1]+hex[1],16);
        g = parseInt(hex[2]+hex[2],16);
        b = parseInt(hex[3]+hex[3],16);
    }
    return `rgba(${r},${g},${b},${alpha})`;
}

/* Build the chart datasets from the historical summary data stored in allYearsData */
function getChartDataFromHistorical() {
    const years = Array.isArray(allYearsData._historicalYears) ? allYearsData._historicalYears.slice().map(Number) : [2022];
    // keep the order left-to-right as shown in table (we inserted years with unshift in addHistoricalYearColumn),
    // but for chart it's clearer to reverse so chronological ascending order
    const sortedYears = years.slice().sort((a,b) => a - b);

    const ganPerProm = [];
    const porcPromA = [];
    const porcPromM = [];
    const tLiqPromM = [];

    const months = getLastTwelveMonths();

    sortedYears.forEach(year => {
        // compute totals similar to renderHistoricalSummary's logic
        let sumPctA = 0, sumPctM = 0;
        let liqAnoM = 0;
        let monthsWithA = 0, monthsWithM = 0, monthsWithYear = 0;

        months.forEach(m => {
            const mm = (allYearsData._historicalManual && allYearsData._historicalManual[year] && allYearsData._historicalManual[year][m]) || null;
            if (mm) {
                const aPct = Number(mm.aldo.pct) || 0;
                const mPct = Number(mm.marcos.pct) || 0;
                const mLq = Number(mm.marcos.liq) || 0;
                const aBr = Number(mm.aldo.bruto) || 0;
                const aLq = Number(mm.aldo.liq) || 0;
                const mBr = Number(mm.marcos.bruto) || 0;

                sumPctA += aPct;
                sumPctM += mPct;
                liqAnoM += mLq;

                const hasA = (aBr !== 0 || aLq !== 0 || aPct !== 0);
                const hasM = (mBr !== 0 || mLq !== 0 || mPct !== 0);
                if (hasA) monthsWithA++;
                if (hasM) monthsWithM++;
                if (hasA || hasM) monthsWithYear++;
            } else {
                // fallback to computed month values from stored financial years
                const mv = monthValues(year, m);
                // treat profit as pct substitute only when manual not present (aligns with fallback behavior)
                sumPctA += 0;
                sumPctM += 0;
                liqAnoM += 0;
                if ((mv.income > 0) || (mv.expenses > 0)) monthsWithYear++;
            }
        });

        // fallback computed totals if manual not explicitly set
        let ganPerAno = sumPctA + sumPctM;
        if (ganPerAno === 0 && !(allYearsData._historicalManual && allYearsData._historicalManual[year] && allYearsData._historicalManual[year].__explicit)) {
            // fallback to computed profit totals across months
            let totalProfit = 0;
            let countMonths = 0;
            months.forEach(m => {
                const mv = monthValues(year, m);
                totalProfit += mv.profit;
                if ((mv.income > 0) || (mv.expenses > 0)) countMonths++;
            });
            ganPerAno = totalProfit;
            monthsWithYear = countMonths;
            // for tLiqPromM we can't compute per-marcos liq from computed fallback, so set 0
            liqAnoM = 0;
        }

        const ganPerPromVal = monthsWithYear > 0 ? (ganPerAno / monthsWithYear) : 0;
        const porcPromAVal = monthsWithA > 0 ? (sumPctA / monthsWithA) : 0;
        const porcPromMVal = monthsWithM > 0 ? (sumPctM / monthsWithM) : 0;
        const tLiqPromMVal = monthsWithM > 0 ? (liqAnoM / monthsWithM) : 0;

        ganPerProm.push(Math.round(ganPerPromVal));
        porcPromA.push(Math.round(porcPromAVal));
        porcPromM.push(Math.round(porcPromMVal));
        tLiqPromM.push(Math.round(tLiqPromMVal));
    });

    return {
        years: sortedYears.map(String),
        ganPerProm,
        porcPromA,
        porcPromM,
        tLiqPromM
    };
}

/* Add a new subcolumn to a specific year: adds a sub label and initializes manual entries for each month */
function addSubcolumn(year) {
    if (!allYearsData._historicalHeaders) allYearsData._historicalHeaders = {};
    if (!allYearsData._historicalHeaders[year]) allYearsData._historicalHeaders[year] = { yearLabel: String(year), sub: ['ALDO', 'MARCOS'] };
    const subs = allYearsData._historicalHeaders[year].sub;
    const newIndex = (subs && subs.length) ? subs.length + 1 : 1;
    const newLabel = `SUB ${newIndex}`;
    subs.push(newLabel);

    // ensure manual data for this new sub exists for every month and year
    if (!allYearsData._historicalManual) allYearsData._historicalManual = {};
    if (!allYearsData._historicalManual[year]) allYearsData._historicalManual[year] = {};
    const months = getLastTwelveMonths();
    months.forEach(m => {
        if (!allYearsData._historicalManual[year][m]) allYearsData._historicalManual[year][m] = {};
        const personKey = newLabel.toString().toLowerCase().replace(/\s+/g, '_');
        allYearsData._historicalManual[year][m][personKey] = { bruto: 0, liq: 0, pct: 0 };
    });

    saveData();
    try { renderHistoricalSummary(); } catch (e) { /* ignore */ }
}

/* Show a simple context menu to delete a subcolumn */
function showSubcolumnContextMenu(event, year, subIndex, thElement) {
    // remove any existing menu
    const existing = document.getElementById('subcolContextMenu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'subcolContextMenu';
    menu.style.position = 'fixed';
    menu.style.left = (event.clientX) + 'px';
    menu.style.top = (event.clientY) + 'px';
    menu.style.background = '#fff';
    menu.style.border = '1px solid #e0e0e0';
    menu.style.boxShadow = '0 4px 10px rgba(0,0,0,0.12)';
    menu.style.padding = '6px';
    menu.style.borderRadius = '6px';
    menu.style.zIndex = 10000;
    menu.style.minWidth = '160px';
    menu.style.fontFamily = 'Arial, sans-serif';
    menu.style.fontSize = '14px';

    const btnDelete = document.createElement('div');
    btnDelete.textContent = 'Eliminar subcolumna';
    btnDelete.style.padding = '8px';
    btnDelete.style.cursor = 'pointer';
    btnDelete.style.color = '#c41e3a';
    btnDelete.addEventListener('click', () => {
        deleteSubcolumn(year, subIndex);
        menu.remove();
    });
    menu.appendChild(btnDelete);

    const btnCancel = document.createElement('div');
    btnCancel.textContent = 'Cancelar';
    btnCancel.style.padding = '8px';
    btnCancel.style.cursor = 'pointer';
    btnCancel.addEventListener('click', () => menu.remove());
    menu.appendChild(btnCancel);

    document.body.appendChild(menu);

    // remove menu when clicking elsewhere or pressing Escape
    function removeMenuHandler(ev) {
        if (ev.type === 'keydown' && ev.key !== 'Escape') return;
        menu.remove();
        document.removeEventListener('click', removeMenuHandler);
        document.removeEventListener('contextmenu', removeMenuHandler);
        document.removeEventListener('keydown', removeMenuHandler);
    }
    // allow a short delay so click that opened menu doesn't immediately close it
    setTimeout(() => {
        document.addEventListener('click', removeMenuHandler);
        document.addEventListener('contextmenu', removeMenuHandler);
        document.addEventListener('keydown', removeMenuHandler);
    }, 0);
}

/* Delete a subcolumn from a specific year, removing header label and manual entries for that person key */
function deleteSubcolumn(year, subIndex) {
    const hdrs = allYearsData._historicalHeaders && allYearsData._historicalHeaders[year];
    if (!hdrs || !Array.isArray(hdrs.sub) || subIndex < 0 || subIndex >= hdrs.sub.length) {
        return;
    }
    const subLabel = hdrs.sub[subIndex] || `SUB ${subIndex+1}`;
    if (!confirm(`Eliminar la subcolumna "${subLabel}" del año ${year}? Esta acción eliminará sus datos manuales.`)) return;

    // remove header label
    hdrs.sub.splice(subIndex, 1);

    // remove manual data keyed for this sub across all months
    const personKey = subLabel.toString().toLowerCase().replace(/\s+/g, '_');
    if (allYearsData._historicalManual && allYearsData._historicalManual[year]) {
        const months = getLastTwelveMonths();
        months.forEach(m => {
            if (allYearsData._historicalManual[year][m] && allYearsData._historicalManual[year][m][personKey]) {
                delete allYearsData._historicalManual[year][m][personKey];
            }
        });
    }

    saveData();
    try { renderHistoricalSummary(); } catch (e) { /* ignore */ }
}

// Inicializar la aplicación cuando se cargue la página
window.onload = function() {
    initializeYearSelector();
    init();
};