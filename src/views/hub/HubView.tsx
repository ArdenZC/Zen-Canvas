import { OrganizeSuggestionsView } from "../organize/OrganizeSuggestionsView";

export function HubView() {
  return <OrganizeSuggestionsView />;
}

export {
  buildOrganizeSuggestions,
  initialOrganizeDecision,
  isSafeBatchSuggestion,
  summarizeOrganizeDecisions
} from "../organize/organizeModel";
