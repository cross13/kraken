// Prism grammar components loaded on demand by `src/lib/prism.ts`. `@types/prismjs`
// only declares the common ones; this wildcard covers the extra installable
// grammars (java, c, php, kotlin, …) so dynamic `import()` typechecks. They are
// side-effect modules that self-register into the shared Prism instance.
declare module 'prismjs/components/*';
