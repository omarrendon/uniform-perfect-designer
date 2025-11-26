import * as XLSX from "xlsx";

export interface ExcelRow {
  nombre: string;
  [key: string]: any;
}

/**
 * Lee un archivo Excel y retorna las filas como objetos
 */
export const readExcelFile = async (
  file: File
): Promise<ExcelRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error("No se pudo leer el archivo"));
          return;
        }

        // Leer el archivo Excel
        const workbook = XLSX.read(data, { type: "binary" });

        // Obtener la primera hoja
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convertir a JSON
        const rawData = XLSX.utils.sheet_to_json<any>(worksheet, { defval: "" });

        // Normalizar los nombres de las columnas (convertir a minúsculas y quitar espacios)
        const jsonData = rawData.map((row: any) => {
          const normalizedRow: any = {};
          Object.keys(row).forEach((key) => {
            const normalizedKey = key.toLowerCase().trim().replace(/\s+/g, '_');
            normalizedRow[normalizedKey] = row[key];
          });
          return normalizedRow;
        });

        // Filtrar filas completamente vacías
        const filteredData = jsonData.filter((row: any) => {
          return Object.values(row).some(val => val !== "" && val !== null && val !== undefined);
        });

        // Validar que tenga datos
        if (filteredData.length === 0) {
          reject(new Error('El archivo Excel está vacío o no contiene datos válidos'));
          return;
        }

        // Validar que tenga la columna "nombre"
        if (!("nombre" in filteredData[0])) {
          const availableColumns = Object.keys(filteredData[0]).join(', ');
          reject(
            new Error(
              `El archivo debe contener una columna llamada "nombre" (puede estar en mayúsculas o minúsculas). Columnas encontradas: ${availableColumns}`
            )
          );
          return;
        }

        resolve(filteredData);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error("Error al leer el archivo"));
    };

    reader.readAsBinaryString(file);
  });
};

/**
 * Valida que el archivo sea un Excel válido
 */
export const validateExcelFile = (file: File): boolean => {
  const validExtensions = [".xlsx", ".xls"];
  const fileName = file.name.toLowerCase();
  return validExtensions.some((ext) => fileName.endsWith(ext));
};
