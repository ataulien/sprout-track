import prisma from './db';
import * as fs from 'fs';
import * as path from 'path';

type UnitData = {
  unitAbbr: string;
  unitName: string;
  activityTypes?: string;
};

type SeedStrings = {
  defaultFamilyName: string;
  defaultFamilySlug: string;
  systemCaretakerName: string;
  systemCaretakerType: string;
  unitNames: Record<string, string>;
};

const EN_UNIT_NAMES: Record<string, string> = {
  OZ: 'Ounces',
  ML: 'Milliliters',
  TBSP: 'Tablespoon',
  LB: 'Pounds',
  IN: 'Inches',
  CM: 'Centimeters',
  G: 'Grams',
  KG: 'Kilograms',
  F: 'Fahrenheit',
  C: 'Celsius',
  MG: 'Milligrams',
  MCG: 'Micrograms',
  L: 'Liters',
  CC: 'Cubic Centimeters',
  MOL: 'Moles',
  MMOL: 'Millimoles',
  DROP: 'Drops',
  DOSE: 'Dose',
  PILL: 'Pill',
  CAP: 'Cap',
  TAB: 'Tab',
  SPRAY: 'Spray',
  INHALER: 'Inhaler',
  INJECTION: 'Injection',
  PATCH: 'Patch',
  CREAM: 'Cream',
  OINTMENT: 'Ointment',
  SUPPOSITORY: 'Suppository'
};

const FR_UNIT_NAMES: Record<string, string> = {
  OZ: 'Onces',
  ML: 'Millilitres',
  TBSP: 'Cuillère à soupe',
  LB: 'Livres',
  IN: 'Pouces',
  CM: 'Centimètres',
  G: 'Grammes',
  KG: 'Kilogrammes',
  F: 'Fahrenheit',
  C: 'Celsius',
  MG: 'Milligrammes',
  MCG: 'Microgrammes',
  L: 'Litres',
  CC: 'Centimètres cubes',
  MOL: 'Moles',
  MMOL: 'Millimoles',
  DROP: 'Gouttes',
  DOSE: 'Dose',
  PILL: 'Pilule',
  CAP: 'Gélule',
  TAB: 'Comprimé',
  SPRAY: 'Spray',
  INHALER: 'Inhalateur',
  INJECTION: 'Injection',
  PATCH: 'Patch',
  CREAM: 'Crème',
  OINTMENT: 'Pommade',
  SUPPOSITORY: 'Suppositoire'
};

const ES_UNIT_NAMES: Record<string, string> = {
  OZ: 'Onzas',
  ML: 'Mililitros',
  TBSP: 'Cucharada',
  LB: 'Libras',
  IN: 'Pulgadas',
  CM: 'Centímetros',
  G: 'Gramos',
  KG: 'Kilogramos',
  F: 'Fahrenheit',
  C: 'Celsius',
  MG: 'Miligramos',
  MCG: 'Microgramos',
  L: 'Litros',
  CC: 'Centímetros cúbicos',
  MOL: 'Moles',
  MMOL: 'Milimoles',
  DROP: 'Gotas',
  DOSE: 'Dosis',
  PILL: 'Píldora',
  CAP: 'Cápsula',
  TAB: 'Tableta',
  SPRAY: 'Spray',
  INHALER: 'Inhalador',
  INJECTION: 'Inyección',
  PATCH: 'Parche',
  CREAM: 'Crema',
  OINTMENT: 'Pomada',
  SUPPOSITORY: 'Supositorio'
};

function getSeedLocale(): string {
  const raw = process.env.SEED_LANGUAGE || process.env.SEED_LOCALE || 'en';
  return raw.toLowerCase();
}

function getSeedStrings(locale: string): SeedStrings {
  if (locale === 'fr') {
    return {
      defaultFamilyName: 'Ma famille',
      defaultFamilySlug: 'ma-famille',
      systemCaretakerName: 'Système',
      systemCaretakerType: 'Administrateur système',
      unitNames: FR_UNIT_NAMES
    };
  }
  if (locale === 'es') {
    return {
      defaultFamilyName: 'Mi familia',
      defaultFamilySlug: 'mi-familia',
      systemCaretakerName: 'Sistema',
      systemCaretakerType: 'Administrador del sistema',
      unitNames: ES_UNIT_NAMES
    };
  }
  return {
    defaultFamilyName: 'My Family',
    defaultFamilySlug: 'my-family',
    systemCaretakerName: 'system',
    systemCaretakerType: 'System Administrator',
    unitNames: EN_UNIT_NAMES
  };
}

async function main() {
  const seedLocale = getSeedLocale();
  const seedStrings = getSeedStrings(seedLocale);

  // Check if any families exist - if not, create the initial family and system caretaker
  const familyCount = await prisma.family.count();
  let defaultFamilyId: string;

  if (familyCount === 0) {
    console.log('No families found. Creating initial family and system caretaker...');
    
    // Create the default family
    const defaultFamily = await prisma.family.create({
      data: {
        name: seedStrings.defaultFamilyName,
        slug: seedStrings.defaultFamilySlug,
        isActive: true
      }
    });
    
    defaultFamilyId = defaultFamily.id;
    console.log(`Created default family: ${defaultFamily.name} (${defaultFamily.slug})`);
    
    // Create the system caretaker associated with the default family
    const systemCaretaker = await prisma.caretaker.create({
      data: {
        loginId: '00',
        name: seedStrings.systemCaretakerName,
        type: seedStrings.systemCaretakerType,
        role: 'ADMIN',
        securityPin: '111222', // Default PIN
        language: seedLocale,
        familyId: defaultFamilyId,
        inactive: false,
        deletedAt: null
      }
    });
    
    console.log(`Created system caretaker with loginId: ${systemCaretaker.loginId}`);
  } else {
    // Get the first family's ID for settings
    const firstFamily = await prisma.family.findFirst();
    defaultFamilyId = firstFamily!.id;
    console.log(`Using existing family: ${firstFamily!.name} for settings`);
  }

  const defaultDateFormat = seedLocale?.startsWith('fr') ? 'DD/MM/YYYY' : 'MM/DD/YYYY';

  // Ensure default settings exist with PIN 111222
  const settingsCount = await prisma.settings.count();
  if (settingsCount === 0) {
    console.log('Creating default settings with PIN: 111222');
    await prisma.settings.create({
      data: {
        familyId: defaultFamilyId,
        familyName: seedStrings.defaultFamilyName,
        securityPin: "111222",
        // authType will be auto-detected based on caretaker existence
        defaultBottleUnit: "OZ",
        defaultSolidsUnit: "TBSP",
        defaultHeightUnit: "IN",
        defaultWeightUnit: "LB",
        defaultTempUnit: "F",
        timeFormat: "24h",
        dateFormat: defaultDateFormat,
        enableDebugTimer: false,
        enableDebugTimezone: false
      }
    });
  } else {
    console.log('Default settings already exist');
  }

  // Define all available units with their activity types
  const unitData: UnitData[] = [
    { unitAbbr: 'OZ', unitName: seedStrings.unitNames.OZ, activityTypes: 'weight,feed,medicine' },
    { unitAbbr: 'ML', unitName: seedStrings.unitNames.ML, activityTypes: 'medicine,feed' },
    { unitAbbr: 'TBSP', unitName: seedStrings.unitNames.TBSP, activityTypes: 'medicine,feed' },
    { unitAbbr: 'LB', unitName: seedStrings.unitNames.LB, activityTypes: 'weight' },
    { unitAbbr: 'IN', unitName: seedStrings.unitNames.IN, activityTypes: 'height' },
    { unitAbbr: 'CM', unitName: seedStrings.unitNames.CM, activityTypes: 'height' },
    { unitAbbr: 'G', unitName: seedStrings.unitNames.G, activityTypes: 'weight,feed,medicine' },
    { unitAbbr: 'KG', unitName: seedStrings.unitNames.KG, activityTypes: 'weight' },
    { unitAbbr: 'F', unitName: seedStrings.unitNames.F, activityTypes: 'temp' },
    { unitAbbr: 'C', unitName: seedStrings.unitNames.C, activityTypes: 'temp' },
    { unitAbbr: 'MG', unitName: seedStrings.unitNames.MG, activityTypes: 'medicine' },
    { unitAbbr: 'MCG', unitName: seedStrings.unitNames.MCG, activityTypes: 'medicine' },
    { unitAbbr: 'L', unitName: seedStrings.unitNames.L, activityTypes: 'medicine' },
    { unitAbbr: 'CC', unitName: seedStrings.unitNames.CC, activityTypes: 'medicine' },
    { unitAbbr: 'MOL', unitName: seedStrings.unitNames.MOL, activityTypes: 'medicine' },
    { unitAbbr: 'MMOL', unitName: seedStrings.unitNames.MMOL, activityTypes: 'medicine' },
    { unitAbbr: 'DROP', unitName: seedStrings.unitNames.DROP, activityTypes: 'medicine' },
    { unitAbbr: 'DOSE', unitName: seedStrings.unitNames.DOSE, activityTypes: 'medicine' },
    { unitAbbr: 'PILL', unitName: seedStrings.unitNames.PILL, activityTypes: 'medicine' },
    { unitAbbr: 'CAP', unitName: seedStrings.unitNames.CAP, activityTypes: 'medicine' },
    { unitAbbr: 'TAB', unitName: seedStrings.unitNames.TAB, activityTypes: 'medicine' },
    { unitAbbr: 'SPRAY', unitName: seedStrings.unitNames.SPRAY, activityTypes: 'medicine' },
    { unitAbbr: 'INHALER', unitName: seedStrings.unitNames.INHALER, activityTypes: 'medicine' },
    { unitAbbr: 'INJECTION', unitName: seedStrings.unitNames.INJECTION, activityTypes: 'medicine' },
    { unitAbbr: 'PATCH', unitName: seedStrings.unitNames.PATCH, activityTypes: 'medicine' },
    { unitAbbr: 'CREAM', unitName: seedStrings.unitNames.CREAM, activityTypes: 'medicine' },
    { unitAbbr: 'OINTMENT', unitName: seedStrings.unitNames.OINTMENT, activityTypes: 'medicine' },
    { unitAbbr: 'SUPPOSITORY', unitName: seedStrings.unitNames.SUPPOSITORY, activityTypes: 'medicine' },
  ];

  // Handle units separately
  await updateUnits(unitData);

  // Seed CDC growth chart data
  await seedCdcGrowthChartData();

  console.log('Seed script completed successfully!');
}

/**
 * Updates units in the database by checking which units exist and only adding the ones that don't exist yet.
 * Also updates existing units with activity types if they don't have them set.
 * @param unitData Array of unit data objects with unitAbbr, unitName, and activityTypes
 */
async function updateUnits(unitData: UnitData[]): Promise<void> {
  console.log('Checking for missing units and updating activity types...');
  
  // Get existing units from the database
  const existingUnits = await prisma.unit.findMany({
    select: { id: true, unitAbbr: true, activityTypes: true, unitName: true }
  });
  
  // Create a map of existing unit abbreviations for faster lookups
  const existingUnitsMap = new Map(
    existingUnits.map(unit => [
      unit.unitAbbr,
      { id: unit.id, activityTypes: unit.activityTypes, unitName: unit.unitName }
    ])
  );
  
  // Filter out units that already exist
  const missingUnits = unitData.filter(unit => !existingUnitsMap.has(unit.unitAbbr));
  
  // Create the missing units
  if (missingUnits.length > 0) {
    console.log(`Adding ${missingUnits.length} missing units: ${missingUnits.map(u => u.unitAbbr).join(', ')}`);
    
    for (const unit of missingUnits) {
      await prisma.unit.create({
        data: {
          ...unit
        }
      });
    }
  } else {
    console.log('All units already exist in the database.');
  }
  
  // Update activity types for all existing units
  const unitsToUpdate = [];
  for (const unit of unitData) {
    const existingUnit = existingUnitsMap.get(unit.unitAbbr);
    if (existingUnit) {
      unitsToUpdate.push({
        id: existingUnit.id,
        unitAbbr: unit.unitAbbr,
        activityTypes: unit.activityTypes,
        unitName: unit.unitName
      });
    }
  }
  
  if (unitsToUpdate.length > 0) {
    console.log(`Updating activity types for ${unitsToUpdate.length} units: ${unitsToUpdate.map(u => u.unitAbbr).join(', ')}`);
    
    for (const unit of unitsToUpdate) {
      console.log(`Setting ${unit.unitAbbr} activity types to: ${unit.activityTypes}`);
      await prisma.unit.update({
        where: { id: unit.id },
        data: { activityTypes: unit.activityTypes, unitName: unit.unitName }
      });
    }
  } else {
    console.log('No units need activity types updated.');
  }
  
  console.log('Units update completed successfully.');
}

/**
 * CDC growth chart record type (without measurementType since we use separate tables)
 */
type CdcGrowthRecord = {
  sex: number;
  ageMonths: number;
  l: number;
  m: number;
  s: number;
  p3: number;
  p5: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p97: number;
};

/**
 * Parses a CDC growth chart CSV file and returns structured data
 * @param filePath Path to the CSV file
 */
function parseCdcCsvFile(filePath: string): CdcGrowthRecord[] {
  let fileContent = fs.readFileSync(filePath, 'utf-8');
  // Remove UTF-8 BOM if present (appears as U+FEFF when read as UTF-8)
  fileContent = fileContent.replace(/^\uFEFF/, '');
  const lines = fileContent.trim().split('\n');

  // Skip the header row
  const dataLines = lines.slice(1);

  return dataLines.map(line => {
    const values = line.split(',');
    return {
      sex: parseInt(values[0], 10),
      ageMonths: parseFloat(values[1]),
      l: parseFloat(values[2]),
      m: parseFloat(values[3]),
      s: parseFloat(values[4]),
      p3: parseFloat(values[5]),
      p5: parseFloat(values[6]),
      p10: parseFloat(values[7]),
      p25: parseFloat(values[8]),
      p50: parseFloat(values[9]),
      p75: parseFloat(values[10]),
      p90: parseFloat(values[11]),
      p95: parseFloat(values[12]),
      p97: parseFloat(values[13]),
    };
  });
}

/**
 * Seeds CDC growth chart reference data from CSV files into separate tables
 * Only inserts data if it doesn't already exist in each table
 */
async function seedCdcGrowthChartData(): Promise<void> {
  console.log('Checking for CDC growth chart data...');

  const documentationDir = path.join(__dirname, '..', 'documentation');

  // Seed weight-for-age data
  const weightCount = await prisma.cdcWeightForAge.count();
  if (weightCount === 0) {
    const weightFilePath = path.join(documentationDir, 'wtageinf.csv');
    if (fs.existsSync(weightFilePath)) {
      const weightData = parseCdcCsvFile(weightFilePath);
      console.log(`Inserting ${weightData.length} records for weight-for-age...`);
      await prisma.cdcWeightForAge.createMany({ data: weightData });
    } else {
      console.warn('Warning: wtageinf.csv not found');
    }
  } else {
    console.log(`Weight-for-age data already exists (${weightCount} records). Skipping.`);
  }

  // Seed length-for-age data
  const lengthCount = await prisma.cdcLengthForAge.count();
  if (lengthCount === 0) {
    const lengthFilePath = path.join(documentationDir, 'lenageinf.csv');
    if (fs.existsSync(lengthFilePath)) {
      const lengthData = parseCdcCsvFile(lengthFilePath);
      console.log(`Inserting ${lengthData.length} records for length-for-age...`);
      // Insert one by one to avoid createMany issues
      for (const record of lengthData) {
        await prisma.cdcLengthForAge.create({ data: record });
      }
    } else {
      console.warn('Warning: lenageinf.csv not found');
    }
  } else {
    console.log(`Length-for-age data already exists (${lengthCount} records). Skipping.`);
  }

  // Seed head circumference-for-age data
  const hcCount = await prisma.cdcHeadCircumferenceForAge.count();
  if (hcCount === 0) {
    const hcFilePath = path.join(documentationDir, 'hcageinf.csv');
    if (fs.existsSync(hcFilePath)) {
      const hcData = parseCdcCsvFile(hcFilePath);
      console.log(`Inserting ${hcData.length} records for head-circumference-for-age...`);
      // Insert one by one to avoid createMany issues
      for (const record of hcData) {
        await prisma.cdcHeadCircumferenceForAge.create({ data: record });
      }
    } else {
      console.warn('Warning: hcageinf.csv not found');
    }
  } else {
    console.log(`Head-circumference-for-age data already exists (${hcCount} records). Skipping.`);
  }

  console.log('CDC growth chart data seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch (error) {
      console.error('Error disconnecting from database:', error);
      process.exit(1);
    }
  });
