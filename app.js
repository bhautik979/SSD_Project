// Global variables to store state
let currentAuthor = null;
let publicationData = null;

// Initialize based on current page
document.addEventListener('DOMContentLoaded', function() {
    // Check which page we're on
    const isResultsPage = window.location.pathname.includes('results.html');
    
    if (!isResultsPage) {
        // We're on index.html
        initializeSearchPage();
    } else {
        // We're on results.html
        initializeResultsPage();
    }
});

function initializeSearchPage() {
    const form = document.getElementById('author-form');
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const authorName = document.getElementById('author').value;
        const authors = await getAuthorsByName(authorName);
        displayAuthors(authors);
    });
}

function initializeResultsPage() {
    // Get author data from sessionStorage
    const authorData = JSON.parse(sessionStorage.getItem('selectedAuthor'));
    if (authorData) {
        document.getElementById('author-name').textContent = `${authorData.given} ${authorData.family}`;
        fetchAuthorPublications(authorData);
    } else {
        window.location.href = 'index.html';
    }
}

function viewAuthorDetails(authorData) {
    // Store author data for the results page
    sessionStorage.setItem('selectedAuthor', JSON.stringify(authorData));
    // Navigate to results page
    window.location.href = 'results.html';
}

async function fetchAuthorPublications(authorData) {
    try {
        const publications = await getPublicationsByAuthor(`${authorData.given} ${authorData.family}`);
        displayPublications(publications);
        renderCitationChart(publications);
    } catch (error) {
        console.error('Error fetching publications:', error);
        document.getElementById('publications-list').innerHTML = 
            '<p class="error">Error loading publications. Please try again.</p>';
    }
}

function displayPublications(publications) {
    const publicationsList = document.getElementById('publications-list');
    publicationsList.innerHTML = ''; // Clear existing content

    publications.forEach(pub => {
        const pubElement = document.createElement('div');
        pubElement.className = 'publication-item';
        pubElement.innerHTML = `
            <h3 class="publication-title">${pub.title[0]}</h3>
            <div class="publication-meta">
                <span>Published: ${formatDate(pub.created['date-time'])}</span>
                <span>Citations: ${pub['is-referenced-by-count'] || 0}</span>
                ${pub.DOI ? `<a href="https://doi.org/${pub.DOI}" target="_blank">DOI: ${pub.DOI}</a>` : ''}
            </div>
        `;
        publicationsList.appendChild(pubElement);
    });
}

function renderCitationChart(publications) {
    const ctx = document.getElementById('impactChart').getContext('2d');
    
    // Process publication data for the chart
    const citationData = publications.map(pub => ({
        title: pub.title[0].substring(0, 30) + '...',
        citations: pub['is-referenced-by-count'] || 0,
        date: new Date(pub.created['date-time'])
    }))
    .sort((a, b) => b.citations - a.citations)
    .slice(0, 10); // Top 10 most cited papers

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: citationData.map(d => d.title),
            datasets: [{
                label: 'Citations',
                data: citationData.map(d => d.citations),
                backgroundColor: 'rgba(66, 153, 225, 0.6)',
                borderColor: 'rgba(66, 153, 225, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Citations'
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Top 10 Most Cited Publications'
                }
            }
        }
    });
}

// Utility function to format dates
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// ... (keep your existing getAuthorsByName and other utility functions)
  
  // Function to fetch author information
  async function getAuthorsByName(searchName) {
    try {
      // Convert search name to lowercase for case-insensitive comparison
      const searchNameLower = searchName.toLowerCase().trim();
      
      // Make the API call with a broader search
      const response = await axios.get(`https://api.crossref.org/works`, {
        params: {
          'query.author': searchName,
          'rows': 100,  // Increase the number of results
          'select': 'DOI,author,title,published-print,container-title,publisher,type,is-referenced-by-count',
          'mailto': 'saianirudh.karre@iiit.ac.in'
        }
      });
  
      const items = response.data.message.items;
      const authorsMap = new Map(); // Use Map to track unique authors
  
      items.forEach(item => {
        if (item.author) {
          item.author.forEach(author => {
            // Create full name variations for matching
            const given = (author.given || '').toLowerCase();
            const family = (author.family || '').toLowerCase();
            const fullName = `${given} ${family}`.trim();
            const reverseName = `${family} ${given}`.trim();
            
            if (fullName.includes(searchNameLower) || 
                reverseName.includes(searchNameLower) ||
                given.includes(searchNameLower) ||
                family.includes(searchNameLower)) {
              
              // Create unique key including affiliation if available
              const affiliation = author.affiliation ? author.affiliation[0]?.name : '';
              const authorKey = `${author.given}-${author.family}-${affiliation}`;
              
              if (!authorsMap.has(authorKey)) {
                // Initialize new author entry
                authorsMap.set(authorKey, {
                  given: author.given || '',
                  family: author.family || '',
                  orcid: author.ORCID || null,
                  affiliation: author.affiliation || [],
                  recentPublications: new Set(),
                  recentVenues: new Set(),
                  publicationYears: new Set(),
                  totalPublications: 0,
                  citationCount: 0
                });
              }
  
              const authorData = authorsMap.get(authorKey);
              authorData.totalPublications++;
              
              // Track publication year
              if (item['published-print']?.['date-parts']?.[0]?.[0]) {
                authorData.publicationYears.add(item['published-print']['date-parts'][0][0]);
              }
              
              // Track recent publications (keep only 3 most recent)
              if (authorData.recentPublications.size < 3) {
                authorData.recentPublications.add(item.title[0]);
              }
              
              // Track publication venues
              if (item['container-title']?.[0]) {
                authorData.recentVenues.add(item['container-title'][0]);
              }
              
              // Update citation count
              if (item['is-referenced-by-count']) {
                authorData.citationCount += item['is-referenced-by-count'];
              }
            }
          });
        }
      });
  
      // Convert Map to array and format the output
      return Array.from(authorsMap.values()).map(author => ({
        ...author,
        recentPublications: Array.from(author.recentPublications),
        recentVenues: Array.from(author.recentVenues),
        yearRange: Array.from(author.publicationYears).sort(),
        averageCitationsPerPaper: author.totalPublications ? 
          (author.citationCount / author.totalPublications).toFixed(2) : 0
      }));
  
    } catch (error) {
      console.error('Error fetching author data:', error);
      throw new Error(`Failed to fetch author data: ${error.message}`);
    }
  }
  
  function displayAuthors(authors) {
    const authorInfo = document.getElementById('author-info');
    authorInfo.innerHTML = ''; // Clear previous data
  
    if (!authors || authors.length === 0) {
      authorInfo.innerHTML = '<p class="no-results">No authors found matching your search criteria.</p>';
      return;
    }
  
    const authorList = document.createElement('div');
    authorList.className = 'author-list';
  
    // Add results summary
    const resultsSummary = document.createElement('div');
    resultsSummary.className = 'results-summary';
    resultsSummary.innerHTML = `<h2>Found ${authors.length} potential matches. Please select the correct author:</h2>`;
    authorInfo.appendChild(resultsSummary);
  
    authors.forEach((author, index) => {
      const authorCard = document.createElement('div');
      authorCard.className = 'author-preview-card';
      
      // Calculate year range string
      const yearRange = author.yearRange.length > 1 ? 
        `${Math.min(...author.yearRange)} - ${Math.max(...author.yearRange)}` : 
        author.yearRange[0] || 'N/A';
  
      authorCard.innerHTML = `
        <div class="author-preview-header">
          <h3>${author.given} ${author.family}</h3>
          ${author.orcid ? `<a href="${author.orcid}" target="_blank" class="orcid-link">ORCID Profile</a>` : ''}
        </div>
        
        <div class="author-preview-details">
          ${author.affiliation && author.affiliation.length > 0 ? 
            `<p><strong>Affiliation:</strong> ${author.affiliation[0].name}</p>` : ''}
          <p><strong>Publication Period:</strong> ${yearRange}</p>
          <p><strong>Total Publications:</strong> ${author.totalPublications}</p>
          <p><strong>Total Citations:</strong> ${author.citationCount}</p>
          
          ${author.recentVenues.length > 0 ? `
            <p><strong>Recent Venues:</strong> ${author.recentVenues.slice(0, 2).join(', ')}</p>
          ` : ''}
          
          ${author.recentPublications.length > 0 ? `
            <div class="recent-publications">
              <strong>Recent Publication:</strong>
              <p class="publication-title">${author.recentPublications[0]}</p>
            </div>
          ` : ''}
        </div>
        
        <button onclick="selectAuthor(${index})" class="view-details-btn">
          View Full Publication History
        </button>
      `;
      
      authorList.appendChild(authorCard);
    });
  
    authorInfo.appendChild(authorList);
  }
  
  // Function to handle author selection
  function selectAuthor(index) {
    // Store the selected author's data
    const selectedAuthor = authors[index];
    sessionStorage.setItem('selectedAuthor', JSON.stringify(selectedAuthor));
    
    // Show loading state
    document.getElementById('author-info').innerHTML = `
      <div class="loading">
        <div class="loader"></div>
        <p>Loading publication details...</p>
      </div>
    `;
  
    // Fetch and display detailed publication data
    fetchAuthorPublications(selectedAuthor);
  }

  
  // Function to fetch and display publications for the selected author
  async function fetchAuthorPublications(authorName) {
    const publications = await getPublicationsByAuthor(authorName);
  
    if (publications && publications.length > 0) {
      const publicationList = document.createElement('ul');
      
      publications.forEach(pub => {
        const listItem = document.createElement('li');
        listItem.innerHTML = `
          <span>${pub.title[0]}</span>
          <button onclick="fetchPaperDetails('${pub.DOI}')">Get Details</button>
        `;
        publicationList.appendChild(listItem);
      });
  
      document.getElementById('author-info').appendChild(publicationList);
    } else {
      console.log('No publications found.');
    }
  }
  
  // Function to fetch publications by author
  async function getPublicationsByAuthor(authorName) {
    try {
      const response = await axios.get(`https://api.crossref.org/works?query.author=${authorName}`);
      return response.data.message.items;
    } catch (error) {
      console.error('Error fetching publication data:', error);
      return null;
    }
  }
  
  // Fetch Paper Details by DOI
  async function fetchPaperDetails(doi) {
    const url = `https://api.crossref.org/works/${doi}`;
  
    try {
      const response = await axios.get(url);
      const paper = response.data.message;
      displayPaperDetails(paper);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }
  
  // Display Paper Details and Render Chart
  function displayPaperDetails(paper) {
    const title = paper.title ? paper.title[0] : "No title available";
    const doi = paper.DOI ? paper.DOI : "No DOI available";
    const citationCount = paper['is-referenced-by-count'] || 0;
    const publishedDate = paper.created ? new Date(paper.created['date-time']).toDateString() : "No date available";
  
    // Display Paper Details
    const detailsHTML = `
        <h2>Paper Details</h2>
        <p><strong>Title:</strong> ${title}</p>
        <p><strong>DOI:</strong> ${doi}</p>
        <p><strong>Citations:</strong> ${citationCount}</p>
        <p><strong>Published Date:</strong> ${publishedDate}</p>
    `;
    document.getElementById('author-info').innerHTML += detailsHTML;
  
    // Render Chart
    renderCitationChart(citationCount);
  }
  
  // Render Citation Chart Using ChartJS
  function renderCitationChart(citationCount) {
    const ctx = document.getElementById('impactChart').getContext('2d');
    
    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Citations'],
            datasets: [{
                label: 'Citation Count',
                data: [citationCount],
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
  }
  