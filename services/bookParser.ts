
import { Book } from '../types';

// These are expected to be available globally from the scripts in index.html
declare const pdfjsLib: any;
declare const JSZip: any;

const CHARS_PER_PAGE_EPUB = 2000;

export const parseBookFile = async (file: File): Promise<Book> => {
  if (file.type === 'application/pdf') {
    return parsePdf(file);
  } else if (file.type === 'application/epub+zip') {
    return parseEpub(file);
  } else {
    throw new Error('Unsupported file type');
  }
};

const parsePdf = async (file: File): Promise<Book> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
  const pages: string[] = [];
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    pages.push(pageText);
  }
  
  const title = file.name.replace(/\.pdf$/i, '');
  return { title, pages };
};

const parseEpub = async (file: File): Promise<Book> => {
    const zip = await JSZip.loadAsync(file);
    
    const containerFile = zip.file("META-INF/container.xml");
    if (!containerFile) throw new Error("Invalid EPUB: META-INF/container.xml not found.");
    const containerXmlText = await containerFile.async("text");
    const parser = new DOMParser();
    const containerDoc = parser.parseFromString(containerXmlText, "application/xml");
    const contentFilePath = containerDoc.getElementsByTagName("rootfile")[0]?.getAttribute("full-path");

    if (!contentFilePath) throw new Error("Invalid EPUB: Could not find content file path.");
    
    const contentFile = zip.file(contentFilePath);
    if (!contentFile) throw new Error(`Invalid EPUB: Content file not found at ${contentFilePath}`);
    const contentXmlText = await contentFile.async("text");
    const contentDoc = parser.parseFromString(contentXmlText, "application/xml");

    const title = contentDoc.getElementsByTagName("dc:title")[0]?.textContent || file.name.replace(/\.epub$/i, '');
    
    const manifestItems: { [id: string]: string } = {};
    const manifest = contentDoc.getElementsByTagName("manifest")[0];
    Array.from(manifest.getElementsByTagName("item")).forEach(item => {
        const id = item.getAttribute("id");
        const href = item.getAttribute("href");
        if(id && href) {
            const pathParts = contentFilePath.split('/');
            pathParts.pop(); // remove filename to get base path
            const basePath = pathParts.join('/');
            manifestItems[id] = basePath ? `${basePath}/${href}` : href;
        }
    });

    const spine = contentDoc.getElementsByTagName("spine")[0];
    const spineRefs = Array.from(spine.getElementsByTagName("itemref")).map(item => item.getAttribute("idref"));

    let fullText = '';
    for (const idref of spineRefs) {
        if (idref) {
            const path = manifestItems[idref];
            if(path) {
                const chapterFile = zip.file(path);
                if (chapterFile) {
                    const chapterHtml = await chapterFile.async("text");
                    const chapterDoc = parser.parseFromString(chapterHtml, "text/html");
                    fullText += chapterDoc.body.textContent || '';
                    fullText += '\n\n';
                }
            }
        }
    }
    
    const pages: string[] = [];
    for (let i = 0; i < fullText.length; i += CHARS_PER_PAGE_EPUB) {
        pages.push(fullText.substring(i, i + CHARS_PER_PAGE_EPUB));
    }

    return { title, pages };
};
