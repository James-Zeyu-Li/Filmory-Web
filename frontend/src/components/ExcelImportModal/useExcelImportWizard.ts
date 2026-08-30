import { useCallback, useState } from 'react';
import {
  commitExcelImport,
  parseAndValidateExcelImport,
  type DuplicateChoice,
  type DuplicateChoiceMap,
  type ImportExcelTranslator,
  type ImportPreview,
  type ImportResult,
} from '../../services/importExcelData';
import { mergeColumnMappingEdits, type MappingEdit } from './mergeColumnMapping';

export type WizardStep = 'upload' | 'mapping' | 'preview' | 'duplicates' | 'submitting' | 'success' | 'error';

const needsMappingStep = (preview: ImportPreview) => (
  preview.mappings.some(mapping => mapping.status === 'needs-user-choice')
);

const defaultDuplicateChoices = (preview: ImportPreview): DuplicateChoiceMap => (
  Object.fromEntries(preview.duplicateGroups.map(group => [group.id, group.choice]))
);

export interface UseExcelImportWizardResult {
  step: WizardStep;
  fileName: string | null;
  preview: ImportPreview | null;
  pendingMappingEdits: MappingEdit[];
  duplicateChoices: DuplicateChoiceMap;
  result: ImportResult | null;
  errorMessage: string | null;
  isBusy: boolean;
  hasVisitedMapping: boolean;
  handleFileSelected: (file: File) => Promise<void>;
  updateMappingChoice: (sheet: MappingEdit['sheet'], expectedField: string, matchedHeader: string | null) => void;
  confirmMappingAndRevalidate: () => Promise<void>;
  goBackToMapping: () => void;
  setDuplicateChoice: (groupId: string, choice: DuplicateChoice) => void;
  confirmPreview: () => void;
  submitImport: () => Promise<void>;
  retryAfterError: () => void;
  restart: () => void;
}

export const useExcelImportWizard = (
  userId: string,
  t: ImportExcelTranslator,
): UseExcelImportWizardResult => {
  const [step, setStep] = useState<WizardStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [pendingMappingEdits, setPendingMappingEdits] = useState<MappingEdit[]>([]);
  const [duplicateChoices, setDuplicateChoices] = useState<DuplicateChoiceMap>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [hasVisitedMapping, setHasVisitedMapping] = useState(false);

  const restart = useCallback(() => {
    setStep('upload');
    setFile(null);
    setPreview(null);
    setPendingMappingEdits([]);
    setDuplicateChoices({});
    setResult(null);
    setErrorMessage(null);
    setIsBusy(false);
    setHasVisitedMapping(false);
  }, []);

  const handleFileSelected = useCallback(async (selectedFile: File) => {
    setIsBusy(true);
    setErrorMessage(null);
    try {
      const nextPreview = await parseAndValidateExcelImport(selectedFile, userId, t);
      setFile(selectedFile);
      setPreview(nextPreview);
      setPendingMappingEdits([]);
      setDuplicateChoices(defaultDuplicateChoices(nextPreview));
      if (needsMappingStep(nextPreview)) {
        setHasVisitedMapping(true);
        setStep('mapping');
      } else {
        setStep('preview');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('excel.parseFallback'));
      setStep('error');
    } finally {
      setIsBusy(false);
    }
  }, [userId, t]);

  const updateMappingChoice = useCallback((
    sheet: MappingEdit['sheet'],
    expectedField: string,
    matchedHeader: string | null,
  ) => {
    setPendingMappingEdits(edits => [
      ...edits.filter(edit => !(edit.sheet === sheet && edit.expectedField === expectedField)),
      { sheet, expectedField, matchedHeader },
    ]);
  }, []);

  const confirmMappingAndRevalidate = useCallback(async () => {
    if (!file || !preview) return;
    setIsBusy(true);
    setErrorMessage(null);
    try {
      const mergedMappings = mergeColumnMappingEdits(preview.mappings, pendingMappingEdits);
      const nextPreview = await parseAndValidateExcelImport(file, userId, t, mergedMappings);
      setPreview(nextPreview);
      setDuplicateChoices(defaultDuplicateChoices(nextPreview));
      setStep(needsMappingStep(nextPreview) ? 'mapping' : 'preview');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('excel.parseFallback'));
      setStep('error');
    } finally {
      setIsBusy(false);
    }
  }, [file, preview, pendingMappingEdits, userId, t]);

  const goBackToMapping = useCallback(() => {
    if (hasVisitedMapping) setStep('mapping');
  }, [hasVisitedMapping]);

  const setDuplicateChoice = useCallback((groupId: string, choice: DuplicateChoice) => {
    setDuplicateChoices(choices => ({ ...choices, [groupId]: choice }));
  }, []);

  const submitImport = useCallback(async () => {
    if (!preview) return;
    setStep('submitting');
    setIsBusy(true);
    setErrorMessage(null);
    try {
      const nextResult = await commitExcelImport(preview, duplicateChoices, userId, t);
      setResult(nextResult);
      setStep('success');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('excel.importFailedTitle'));
      setStep('error');
    } finally {
      setIsBusy(false);
    }
  }, [preview, duplicateChoices, userId, t]);

  const retryAfterError = useCallback(() => {
    if (!preview) {
      restart();
      return;
    }
    setErrorMessage(null);
    setStep(preview.duplicateGroups.length > 0 ? 'duplicates' : 'preview');
  }, [preview, restart]);

  // Preview's "continue" skips straight to submitting when there are no
  // duplicate groups to resolve, instead of rendering an empty step.
  const confirmPreview = useCallback(() => {
    if (!preview) return;
    if (preview.duplicateGroups.length > 0) {
      setStep('duplicates');
    } else {
      void submitImport();
    }
  }, [preview, submitImport]);

  return {
    step,
    fileName: file?.name ?? null,
    preview,
    pendingMappingEdits,
    duplicateChoices,
    result,
    errorMessage,
    isBusy,
    hasVisitedMapping,
    handleFileSelected,
    updateMappingChoice,
    confirmMappingAndRevalidate,
    goBackToMapping,
    setDuplicateChoice,
    confirmPreview,
    submitImport,
    retryAfterError,
    restart,
  };
};
