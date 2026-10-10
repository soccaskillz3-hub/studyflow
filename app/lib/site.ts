// How to reach whoever runs Zeflo, shown on the privacy, terms and support pages.

// TODO: the Zeflo support address, once it's set up. Until then, people get in touch through
// the project's GitHub page.
export const SUPPORT_EMAIL: string | null = null;

export const CONTACT = SUPPORT_EMAIL
  ? {href: `mailto:${SUPPORT_EMAIL}`, label: SUPPORT_EMAIL}
  : {href: "https://github.com/soccaskillz3-hub/zeflo/issues", label: "Zeflo’s GitHub page"};

// When the privacy policy and terms last changed.
export const POLICIES_UPDATED = "October 10, 2026";
