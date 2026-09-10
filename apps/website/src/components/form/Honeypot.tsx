'use client';

/** A bot trap: intentionally absent from keyboard and assistive navigation. */
export function Honeypot() {
  return (
    <div aria-hidden="true" className="form-honeypot">
      <input
        type="text"
        name="website_url"
        tabIndex={-1}
        autoComplete="off"
        data-1p-ignore="true"
        data-lpignore="true"
        maxLength={200}
        defaultValue=""
      />
    </div>
  );
}

export function readHoneypot(form: HTMLFormElement): string {
  const value = new FormData(form).get('website_url');
  return typeof value === 'string' ? value : '';
}
