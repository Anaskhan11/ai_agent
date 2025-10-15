const contactModel = require("../../model/contactModel/contactModel");

// const getAllContacts = async (req, res) => {
//   try {
//     // Extract pagination parameters from query string
//     const pageParam = parseInt(req.query.page);
//     const limitParam = parseInt(req.query.limit);

//     const page = !isNaN(pageParam) && pageParam > 0 ? pageParam : 1;
//     const limit = !isNaN(limitParam) && limitParam > 0 ? limitParam : 10;

//     const { contacts, totalContacts } = await contactModel.getAllContacts(
//       page,
//       limit
//     );

//     const totalPages = Math.ceil(totalContacts / limit);

//     // Ensure the page does not exceed total pages
//     const currentPage = page > totalPages && totalPages > 0 ? totalPages : page;

//     res.status(200).json({
//       contacts,
//       totalContacts,
//       currentPage,
//       totalPages,
//     });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

const getAllContacts = async (req, res) => {
  try {
    // Handle different token structures
    const userId = req.user?.user?.id || req.user?.id;
    const pageParam = parseInt(req.query.page);
    const limitParam = parseInt(req.query.limit);
    const search = req.query.search || "";

    const page = !isNaN(pageParam) && pageParam > 0 ? pageParam : 1;
    const limit = !isNaN(limitParam) && limitParam > 0 ? limitParam : 10;

    const result = await contactModel.getAllContacts(
      page,
      limit,
      search,
      userId
    );

    res.status(200).json({
      success: true,
      data: result.contacts,
      pagination: {
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        totalContacts: result.totalContacts,
        limit
      }
    });
  } catch (err) {
    console.error("Error in getAllContacts:", err);
    res.status(500).json({ error: err.message });
  }
};

const getListNamesWithContactCount = async (req, res) => {
  try {
    // Handle different token structures
    const userId = req.user?.user?.id || req.user?.id;

    if (!userId) {
      console.error("User ID not found in token for getListNamesWithContactCount. Token structure:", JSON.stringify(req.user, null, 2));
      return res.status(401).json({ error: "User not authenticated" });
    }

    const data = await contactModel.getListNamesWithContactCount(userId);

    if (!data || data.length === 0) {
      return res.status(404).json({ message: "No lists found" });
    }

    res.status(200).json(data);
  } catch (err) {
    console.error("Error in getListNamesWithContactCount:", err);
    res.status(500).json({ error: err.message });
  }
};
const getContactById = async (req, res) => {
  try {
    const contact_id = req.params.id;
    const contact = await contactModel.getContactById(contact_id);
    if (contact) {
      res.status(200).json(contact);
    } else {
      res.status(404).json({ message: "Contact not found" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createContacts = async (req, res) => {
  try {
    const { user_id, list_name, list_description, contacts } = req.body;

    // Validate input
    if (
      !user_id ||
      !list_name ||
      !list_description ||
      !Array.isArray(contacts)
    ) {
      return res.status(400).json({ error: "Invalid input data" });
    }

    // Ensure each contact has email and contact_number
    for (const contact of contacts) {
      if (!contact.email || !contact.contact_number) {
        return res.status(400).json({
          error: "Each contact must have an email and contact_number",
        });
      }
    }

    const result = await contactModel.createContacts(
      user_id,
      list_name,
      list_description,
      contacts
    );
    res
      .status(201)
      .json({ message: "Contacts List created Sucessfully", data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update a single contact by ID
const updateContactById = async (req, res) => {
  try {
    // Handle different token structures
    const userId = req.user?.user?.id || req.user?.id;
    const contactId = req.params.id;
    const updates = req.body;

    if (!userId) {
      console.error("User ID not found in token for updateContactById. Token structure:", JSON.stringify(req.user, null, 2));
      return res.status(401).json({ error: "User not authenticated" });
    }

    const result = await contactModel.updateContactById(contactId, userId, updates);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Contact not found or no changes made" });
    }

    res.status(200).json({
      success: true,
      message: "Contact updated successfully"
    });
  } catch (err) {
    console.error("Error in updateContactById:", err);
    res.status(500).json({ error: err.message });
  }
};

// Legacy update function for backward compatibility
const updateContact = async (req, res) => {
  try {
    const { user_id, list_name, list_description, contacts } = req.body;

    // Validate input
    if (
      !user_id ||
      !list_name ||
      !list_description ||
      !Array.isArray(contacts)
    ) {
      return res.status(400).json({ error: "Invalid input data" });
    }

    // Ensure each contact has contact_id, email, and contact_number
    for (const contact of contacts) {
      if (!contact.contact_id || !contact.email || !contact.contact_number) {
        return res.status(400).json({
          error: "Each contact must have contact_id, email, and contact_number",
        });
      }
    }

    const result = await contactModel.updateContact(
      user_id,
      list_name,
      list_description,
      contacts
    );
    res.status(200).json({
      success: true,
      message: "Contacts updated successfully",
      data: result
    });
  } catch (err) {
    console.error("Error in updateContact:", err);
    res.status(500).json({ error: err.message });
  }
};

const deleteContact = async (req, res) => {
  try {
    // Handle different token structures
    const userId = req.user?.user?.id || req.user?.id;
    const contactId = req.params.id;

    if (!userId) {
      console.error("User ID not found in token for deleteContact. Token structure:", JSON.stringify(req.user, null, 2));
      return res.status(401).json({ error: "User not authenticated" });
    }

    const result = await contactModel.deleteContact(contactId, userId);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Contact not found or access denied" });
    }

    res.status(200).json({
      success: true,
      message: "Contact deleted successfully"
    });
  } catch (err) {
    console.error("Error in deleteContact:", err);
    res.status(500).json({ error: err.message });
  }
};

const getContactsByList = async (req, res) => {
  try {
    const { list_name, page } = req.params;
    const limitParam = parseInt(req.query.limit);
    const limit = !isNaN(limitParam) && limitParam > 0 ? limitParam : 10; // Default limit is 10

    if (!list_name) {
      return res.status(400).json({ error: "list_name is required" });
    }

    const pageNumber =
      !isNaN(parseInt(page)) && parseInt(page) > 0 ? parseInt(page) : 1;

    const data = await contactModel.getContactsByList(
      list_name,
      pageNumber,
      limit
    );

    if (!data) {
      return res
        .status(404)
        .json({ message: "No contacts found for the given list_name" });
    }

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getAllContacts,
  getListNamesWithContactCount,
  getContactById,
  createContacts,
  updateContact,
  updateContactById,
  deleteContact,
  getContactsByList,
};
