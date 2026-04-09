const bcrypt = require('bcryptjs') // Hash mật khẩu khi tạo/cập nhật user
const { User } = require('../models') // Model User để CRUD
const { sanitizeUser } = require('./AuthService') // Loại bỏ password_hash khi trả về

class AdminUserService {
  // List toàn bộ users (admin only)
  async listUsers() {
    const users = await User.findAll({ order: [['user_id', 'ASC']] }) // Sort ổn định cho UI
    return users.map((u) => sanitizeUser(u)) // Không trả password_hash
  }

  // Tạo user mới: admin được set role explicit
  async createUser({ username, email, password, full_name, role }) {
    // Hash password để bảo mật
    const password_hash = await bcrypt.hash(password, 10)
    // Tạo user
    const created = await User.create({
      username,
      email,
      full_name,
      role,
      password_hash,
      avatar_url: null,
    })
    return sanitizeUser(created)
  }

  // Update user: admin đổi thông tin và role, nhưng cấm tự hạ role xuống user
  async updateUser({ adminUserId, targetUserId, patch }) {
    // Nếu admin đang update chính mình và có ý định đổi role xuống 'user' thì chặn (no self-demotion)
    if (Number(adminUserId) === Number(targetUserId) && patch.role && patch.role === 'user') {
      const err = new Error('Không thể tự hạ quyền của chính mình')
      err.statusCode = 400
      throw err
    }

    // Không cho update password_hash ở đây trừ khi bạn muốn mở rộng sau (giảm bề mặt tấn công)
    const allowed = {}
    if (patch.username != null) allowed.username = patch.username
    if (patch.email != null) allowed.email = patch.email
    if (patch.full_name != null) allowed.full_name = patch.full_name
    if (patch.role != null) allowed.role = patch.role

    // Update theo id
    const [updated] = await User.update(allowed, { where: { user_id: targetUserId } })
    if (!updated) return null
    const user = await User.findByPk(targetUserId)
    return sanitizeUser(user)
  }

  // Delete user: cấm admin tự xóa chính mình (no self-deletion)
  async deleteUser({ adminUserId, targetUserId }) {
    if (Number(adminUserId) === Number(targetUserId)) {
      const err = new Error('Không thể tự xóa tài khoản của chính mình')
      err.statusCode = 400
      throw err
    }
    const deleted = await User.destroy({ where: { user_id: targetUserId } })
    return Boolean(deleted)
  }
}

module.exports = { AdminUserService }

