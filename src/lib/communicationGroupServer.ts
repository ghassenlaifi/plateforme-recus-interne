import { DEFAULT_COMMUNICATION_GROUPS } from '@/types/communicationGroup';
import CommunicationGroupModel from '@/models/CommunicationGroup';

/**
 * Assure que les groupes de communication standards sont initialisés en base MongoDB
 * uniquement si la collection est complètement vide (première initialisation).
 * Respecte scrupuleusement les suppressions et ajouts effectués par les administrateurs.
 */
export async function ensureCommunicationGroupsSeeded(): Promise<void> {
  const count = await CommunicationGroupModel.countDocuments();
  if (count === 0) {
    for (const def of DEFAULT_COMMUNICATION_GROUPS) {
      await CommunicationGroupModel.create(def);
    }
  }
}

/**
 * Réinitialise manuellement les groupes aux valeurs par défaut si explicitement demandé.
 */
export async function resetCommunicationGroupsToDefault(): Promise<void> {
  await CommunicationGroupModel.deleteMany({});
  for (const def of DEFAULT_COMMUNICATION_GROUPS) {
    await CommunicationGroupModel.create(def);
  }
}

