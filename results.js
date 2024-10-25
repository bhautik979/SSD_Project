document.addEventListener('DOMContentLoaded', async function() {
    // Get the author's name from the URL query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const authorName = urlParams.get('author');
    
    // Call the API to fetch author information
    const authors = await getAuthorsByName(authorName);
    
    if (authors && authors.length > 0) {
      const authorList = document.getElementById('author-list');
      
      // Create a list of authors with basic details
      authors.forEach((author, index) => {
        const listItem = document.createElement('li');
        listItem.innerHTML = `
          <p><strong>Name:</strong> ${author.given} ${author.family}</p>
          <p><strong>ORCID:</strong> ${author.orcid || 'N/A'}</p>
          <p><strong>Affiliation:</strong> ${author.affiliation ? author.affiliation[0].name : 'N/A'}</p>
          <button onclick="fetchAuthorPublications(${index})">View Publications</button>
        `;
        authorList.appendChild(listItem);
      });
    } else {
      console.log('No authors found.');
    }
  });
  
  // Function to fetch author information
// Function to fetch author information
async function getAuthorsByName(authorName) {
    try {
        const response = await axios.get(`https://api.crossref.org/works?query.author=${authorName}`);
        const items = response.data.message.items;

        // Extract and collect unique authors from the publications
        let authors = [];
        items.forEach(item => {
            item.author.forEach(author => {
                const fullName = `${author.given} ${author.family}`;
                // Use a case-insensitive check to see if the input is part of the author's full name
                if (fullName.toLowerCase().includes(authorName.toLowerCase()) && 
                    !authors.some(a => a.given === author.given && a.family === author.family)) {
                    authors.push({
                        given: author.given,
                        family: author.family,
                        orcid: author.ORCID,
                        affiliation: author.affiliation
                    });
                }
            });
        });
        
        return authors;
    } catch (error) {
        console.error('Error fetching author data:', error);
        return null;
    }
}
  
  
  // Function to fetch and display publications for the selected author
  async function fetchAuthorPublications(authorIndex) {
    const authorName = document.getElementById('author-list').children[authorIndex].querySelector('strong').textContent;
    const publications = await getPublicationsByAuthor(authorName);
  
    const publicationsList = document.getElementById('publications-list');
    publicationsList.innerHTML = '';  // Clear previous list
    
    if (publications && publications.length > 0) {
      publications.forEach(pub => {
        const listItem = document.createElement('li');
        listItem.textContent = pub.title[0]; // Display the title of the publication
        publicationsList.appendChild(listItem);
      });
    } else {
      console.log('No publications found.');
    }
  }
  
  // Function to make the API call for publications
  async function getPublicationsByAuthor(authorName) {
    try {
      const response = await axios.get(`https://api.crossref.org/works?query.author=${authorName}`);
      const publications = response.data.message.items;
      return publications;
    } catch (error) {
      console.error('Error fetching publication data:', error);
      return null;
    }
  }
  