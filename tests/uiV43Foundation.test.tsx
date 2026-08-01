// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button, DurableTaskStatus, InspectorLayout, MetricStrip, SearchField, SideSheet, StateBlock } from "../src/views/shared/ui";
import { readFileSync } from "node:fs";

describe("V4.3 shared design foundation", () => {
  it("defines semantic density and pane tokens", () => {
    const tokens = readFileSync("src/styles/tokens.css", "utf8");
    const styles = readFileSync("src/styles.css", "utf8");
    for (const token of [
      "--zc-radius-row",
      "--zc-control-height-compact",
      "--zc-control-height-default",
      "--zc-row-height-compact",
      "--zc-row-height-default",
      "--zc-inspector-width",
      "--zc-sheet-width",
      "--zc-content-max-width"
    ]) {
      expect(tokens).toContain(token);
    }
    expect(styles).toContain('[data-density="default"]');
    expect(styles).toContain('[data-density="compact"]');
  });

  it("keeps shared controls semantic and density-aware", () => {
    const markup = renderToStaticMarkup(
      <div>
        <Button variant="primary" size="compact">Run</Button>
        <SearchField value="report!" label="Search files" clearLabel="Clear" onChange={() => {}} onClear={() => {}} />
        <MetricStrip ariaLabel="Summary" density="compact" items={[{ label: "Ready", value: 6 }]} />
        <DurableTaskStatus state="running" title="Updating" progress={{ label: "Progress", value: 2, max: 4 }} density="compact" />
        <StateBlock tone="warning" density="compact" title="Needs attention" description="Review the next step." />
      </div>
    );

    expect(markup).toContain("data-search-field=\"true\"");
    expect(markup).toContain("data-metric-strip=\"true\"");
    expect(markup).toContain("data-durable-task=\"running\"");
    expect(markup).toContain("role=\"progressbar\"");
    expect(markup).toContain("data-density=\"compact\"");
    expect(markup).not.toContain("rounded-[var(--radius-md)]");
  });

  it("provides an isolated Side Sheet and responsive Inspector layout", () => {
    const markup = renderToStaticMarkup(
      <SideSheet open title="Details" closeLabel="Close" onClose={() => {}} side="right">
        <p>Content</p>
      </SideSheet>
    );
    const layout = renderToStaticMarkup(<InspectorLayout main={<p>Files</p>} inspector={<p>Details</p>} inspectorLabel="Inspector" />);

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('data-side-sheet="true"');
    expect(markup).toContain('data-side="right"');
    expect(layout).toContain('data-inspector-layout="true"');
    expect(layout).toContain('data-inspector="true"');
  });
});
