<script lang="ts">
  import type { Settings } from '../settings/schema';
  import type { RecordFormat, RecordPrefs } from '../record/liveRecorder';
  import type { RenderRequest } from '../record/renderJob';
  import PanelDrawer from './PanelDrawer.svelte';
  import RecordPanel from './RecordPanel.svelte';
  import RenderPanel from './RenderPanel.svelte';
  import SectionHeading from './SectionHeading.svelte';
  import ShareLink from './ShareLink.svelte';
  import { Button } from 'flowbite-svelte';
  import { ImageOutline } from 'flowbite-svelte-icons';

  let {
    open = $bindable(),
    width = $bindable(400),
    settings,
    renderBusy,
    onrender,
    recordPrefs = $bindable(),
    formats,
    recording,
    elapsed,
    ontogglerecording,
    onsnapshot,
  }: {
    open: boolean;
    width?: number;
    settings: Settings;
    /** A render or recording is running, or the save dialog is open. */
    renderBusy: boolean;
    onrender: (req: RenderRequest) => void;
    recordPrefs: RecordPrefs;
    formats: RecordFormat[];
    recording: boolean;
    elapsed: number;
    ontogglerecording: () => void;
    /** Save the frame on screen as a PNG. */
    onsnapshot: () => void;
  } = $props();
</script>

<PanelDrawer bind:open bind:width title="Export">
  <div class="settings-scroll min-h-0 flex-1 space-y-4 overflow-y-auto py-2 pe-3">
    <div class="space-y-1">
      <SectionHeading>Share link</SectionHeading>
      <p class="pt-1 text-xs text-gray-400">
        Opens the app with your current settings. They're stored in the link itself, so nothing is uploaded. Your
        Display settings stay yours.
      </p>
    </div>
    <ShareLink {settings} />

    <div class="space-y-1 pt-6">
      <SectionHeading>Snapshot</SectionHeading>
      <p class="pt-1 text-xs text-gray-400">
        Saves the frame on screen as a PNG image, without the controls, at the preview’s resolution (Display → Render
        scale lowers it).
      </p>
    </div>
    <Button size="sm" color="alternative" class="w-full" disabled={renderBusy} onclick={onsnapshot}>
      <ImageOutline class="me-2 h-4 w-4" /> Save frame as PNG
    </Button>

    <div class="space-y-1 pt-6">
      <SectionHeading>Render to file</SectionHeading>
      <p class="pt-1 text-xs text-gray-400">
        Best quality: every frame is rendered exactly, at any size, and can loop seamlessly. Uses your current
        settings.
      </p>
    </div>
    <RenderPanel busy={renderBusy} {settings} {onrender} />

    <div class="space-y-1 pt-6">
      <SectionHeading>Live recording</SectionHeading>
      <p class="pt-1 text-xs text-gray-400">
        Captures the screen as it plays, including any changes you make while recording (R starts and stops it).
      </p>
    </div>
    <RecordPanel bind:prefs={recordPrefs} {formats} {recording} {elapsed} ontoggle={ontogglerecording} />
  </div>
</PanelDrawer>
