// Medarbejdere. Vælges på startsiden (ingen login i V1). Alle ser alle
// kategorier; registreringer er pr. medarbejder (employeeId på hver linje).

export interface Employee {
  id: string;
  name: string;
}

export const EMPLOYEES: Employee[] = [
  { id: "anders", name: "Anders" },
  { id: "natasha", name: "Natasha" },
  { id: "henriette", name: "Henriette" },
  { id: "ida", name: "Ida" },
  { id: "marie", name: "Marie" },
  { id: "andreas", name: "Andreas" },
  { id: "sascha", name: "Sascha" },
  { id: "ina", name: "Ina" },
  { id: "lissy", name: "Lissy" },
  { id: "dana", name: "Dana" },
];

const byId = new Map(EMPLOYEES.map((e) => [e.id, e]));

export function getEmployee(id: string | null): Employee | undefined {
  if (!id) return undefined;
  return byId.get(id);
}
