import { buildSandboxHtml } from './buildHtml';

describe('buildSandboxHtml', () => {
  it('embeds the markup and CSS', () => {
    const html = buildSandboxHtml('<svg id="art"></svg>', '#art { fill: red; }');
    expect(html).toContain('<svg id="art"></svg>');
    expect(html).toContain('#art { fill: red; }');
  });

  it('prevents CSS from closing the style tag', () => {
    const html = buildSandboxHtml('', '/* sneaky </style><script>x()</script> */');
    expect(html).not.toContain('</style><script>');
  });
});
