import { useId, useState } from 'react';
import { downscaleImage, ErrorText } from '../lib/ui';

/** Optional photo for a vision item, downscaled to 512 px and kept as a data URL on the device. */
export function ImagePicker({ value, onChange }: { value?: string; onChange: (dataUrl: string | undefined) => void }) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-mid">Photo, optional</span>
      <div className="flex flex-wrap items-center gap-3">
        {value ? (
          <img src={value} alt="The chosen photo" className="h-10 w-10 shrink-0 object-cover" />
        ) : (
          <span aria-hidden="true" className="h-10 w-10 shrink-0 border border-dashed border-faint" />
        )}
        <label htmlFor={id} className="cursor-pointer text-walnut">
          {busy ? 'Reading the photo' : value ? 'Change the photo' : 'Choose a photo'}
        </label>
        <input
          id={id}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setBusy(true);
            setError(null);
            try {
              onChange(await downscaleImage(file, 512));
            } catch (err) {
              setError(err instanceof Error ? err.message : 'That photo could not be read.');
            } finally {
              setBusy(false);
            }
          }}
        />
        {value ? (
          <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-mid" onClick={() => onChange(undefined)}>
            Remove the photo
          </button>
        ) : null}
      </div>
      {error ? <ErrorText>{error}</ErrorText> : null}
    </div>
  );
}
