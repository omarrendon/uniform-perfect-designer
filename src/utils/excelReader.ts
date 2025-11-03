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
        const jsonData = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);

        // Validar que tenga la columna "nombre"
        if (jsonData.length > 0 && !("nombre" in jsonData[0])) {
          reject(
            new Error(
              'El archivo debe contener una columna llamada "nombre"'
            )
          );
          return;
        }

        resolve(jsonData);
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
