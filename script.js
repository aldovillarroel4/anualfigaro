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