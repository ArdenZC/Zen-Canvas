import { createContext, useContext, type ReactNode } from "react";

export type FileLibraryWorkspaceLayout = "large" | "medium" | "compact";

const ContextPanelPresentationContext = createContext<FileLibraryWorkspaceLayout>("compact");

export function ContextPanelPresentationProvider({
  layout,
  children
}: {
  layout: FileLibraryWorkspaceLayout;
  children: ReactNode;
}) {
  return (
    <ContextPanelPresentationContext.Provider value={layout}>
      {children}
    </ContextPanelPresentationContext.Provider>
  );
}

export function useContextPanelPresentation() {
  return useContext(ContextPanelPresentationContext);
}
