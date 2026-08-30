import type { ImportColumnMapping, ImportSheetName } from '../../services/importExcelData';

export interface MappingEdit {
  sheet: ImportSheetName;
  expectedField: string;
  matchedHeader: string | null; // null = user explicitly chose "skip this field"
}

/**
 * Produces the FULL replacement mapping array for re-validation. Stage A's
 * `parseAndValidateExcelImport(..., mappingOverrides)` replaces a sheet's
 * entire mapping set when any override is supplied for it, so this can't
 * just return the edited entries — every mapping for an edited sheet must
 * be included, edited or not.
 */
export const mergeColumnMappingEdits = (
  originalMappings: ImportColumnMapping[],
  edits: MappingEdit[],
): ImportColumnMapping[] => originalMappings.map(mapping => {
  const edit = edits.find(e => e.sheet === mapping.sheet && e.expectedField === mapping.expectedField);
  if (!edit) return mapping;

  return {
    ...mapping,
    matchedHeader: edit.matchedHeader,
    status: edit.matchedHeader
      ? 'auto-matched'
      : (mapping.required ? 'needs-user-choice' : 'skipped'),
  };
});
